const axios = require('axios');
const cheerio = require('cheerio');
const env = require('../../config/env');
const { getJson, setJson } = require('../../redis/client');

const CACHE_TTL_SECONDS = 12 * 60;

const client = axios.create({
  baseURL: env.platforms.codechefBaseUrl,
  timeout: 10000,
  headers: {
    'user-agent': 'CPInsight/1.0 (+https://cpinsight.local)',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

class CodeChefError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CodeChefError';
    this.platform = 'codechef';
    this.cause = cause;
  }
}

function cleanText(value) {
  return (value || '').toString().replace(/\s+/g, ' ').trim();
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const match = value.toString().replace(/,/g, '').match(/-?\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function epochSeconds(value) {
  if (!value) return null;
  const text = value.toString().trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 100000000000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function codeChefTimestampSeconds(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/i);
  if (!match) return epochSeconds(text);

  let [, hourText, minuteText, meridiem, monthText, dayText, yearText] = match;
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const month = Number(monthText);
  const day = Number(dayText);
  let year = Number(yearText);

  if (year < 100) year += 2000;
  if (/pm/i.test(meridiem) && hour !== 12) hour += 12;
  if (/am/i.test(meridiem) && hour === 12) hour = 0;

  const millis = Date.UTC(year, month - 1, day, hour, minute, 0);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
}

function dateKeyFromValue(value) {
  const dateParts = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateParts) {
    const [, year, month, day] = dateParts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const seconds = epochSeconds(value);
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function extractBalanced(source, startIndex, opener, closer) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return source.slice(startIndex, index + 1);
  }

  return null;
}

function parseJavascriptLiteral(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // CodeChef embeds JSON-like JavaScript. Evaluate only the extracted literal,
    // after removing executable wrappers such as Date constructors.
  }

  try {
    const sanitized = raw.replace(/new Date\(([^)]*)\)/g, 'String($1)');
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${sanitized});`)();
  } catch {
    return null;
  }
}

function extractAssignedLiteral(html, variablePattern, opener, closer) {
  const marker = new RegExp(`${variablePattern}\\s*=`);
  const match = marker.exec(html);
  if (!match) return null;

  const start = html.indexOf(opener, match.index);
  if (start === -1) return null;

  return extractBalanced(html, start, opener, closer);
}

function normalizeHeatmap(rawStats) {
  const heatmap = {};
  const rows = Array.isArray(rawStats)
    ? rawStats
    : rawStats && typeof rawStats === 'object'
      ? Object.entries(rawStats).map(([date, count]) => ({ date, count }))
      : [];

  for (const row of rows) {
    if (!row) continue;

    if (Array.isArray(row)) {
      const day = dateKeyFromValue(row[0]);
      const count = toNumber(row[1]);
      if (day && count && count > 0) heatmap[day] = (heatmap[day] || 0) + count;
      continue;
    }

    const rawDate = row.date || row.day || row.d || row.name || row[0] || row.time || row.timestamp;
    const rawCount = row.count || row.value || row.submissions || row.y || row[1] || row.total;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate)) ? String(rawDate) : dateKeyFromValue(rawDate);
    const count = toNumber(rawCount);
    if (day && count && count > 0) heatmap[day] = (heatmap[day] || 0) + count;
  }

  return heatmap;
}

function parseHeatmap(html) {
  const literal = extractAssignedLiteral(html, 'var\\s+userDailySubmissionsStats', '[', ']');
  return normalizeHeatmap(parseJavascriptLiteral(literal));
}

function findDrupalSettings(html) {
  const direct = extractAssignedLiteral(html, 'Drupal\\.settings', '{', '}');
  if (direct) return parseJavascriptLiteral(direct);

  const extendIndex = html.indexOf('jQuery.extend(Drupal.settings');
  if (extendIndex !== -1) {
    const start = html.indexOf('{', extendIndex);
    const extended = start === -1 ? null : extractBalanced(html, start, '{', '}');
    if (extended) return parseJavascriptLiteral(extended);
  }

  const index = html.indexOf('date_versus_rating');
  if (index === -1) return null;

  const objectStart = html.lastIndexOf('{', index);
  if (objectStart === -1) return null;
  return parseJavascriptLiteral(extractBalanced(html, objectStart, '{', '}'));
}

function normalizeContest(item, index) {
  if (!item) return null;

  const contestCode = cleanText(
    item.contest_code || item.code || item.contestCode || item.contest_id || item.contestId || item[0]
  );
  const contestName = cleanText(
    item.contest_name || item.name || item.contestName || item.title || item[1] || contestCode || 'CodeChef Contest'
  );
  const rating = toNumber(item.rating || item.new_rating || item.newRating || item[2] || item.y);
  const rank = toNumber(item.rank || item.global_rank || item.globalRank);
  const dateValue = item.end_date || item.date || item.time || item.ratingUpdateTimeSeconds || item.x || item[4];
  const seconds = epochSeconds(dateValue);

  if (!seconds && rating === null && !contestName) return null;

  return {
    contestId: contestCode || `codechef-contest-${index + 1}`,
    contestName,
    oldRating: null,
    newRating: rating,
    ratingUpdateTimeSeconds: seconds || Math.floor(Date.now() / 1000),
    rank,
    metadata: {
      contestCode: contestCode || null,
      date: dateKeyFromValue(dateValue)
    }
  };
}

function parseContestHistory(html) {
  const rankLookup = parseContestRankCards(html);
  const settings = findDrupalSettings(html);
  const rawSource = settings?.date_versus_rating
    || settings?.dateVersusRating
    || settings?.user?.date_versus_rating
    || settings?.codechef?.date_versus_rating;
  const source = Array.isArray(rawSource?.all) ? rawSource.all : rawSource;

  const contests = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? Object.values(source)
      : [];

  const parsed = contests
      .map(normalizeContest)
      .map((contest) => {
        if (!contest) return contest;
        const contestIdKey = cleanText(contest.contestId).toLowerCase();
        const contestNameKey = cleanText(contest.contestName).toLowerCase();
        return {
          ...contest,
          rank: contest.rank || rankLookup[contestIdKey] || rankLookup[contestNameKey] || null
        };
      })
      .filter(Boolean)
      .sort(
          (a, b) =>
              a.ratingUpdateTimeSeconds -
              b.ratingUpdateTimeSeconds
      );

  for (let i = 0; i < parsed.length; i++) {
      if (parsed[i].oldRating == null) {
          parsed[i].oldRating = i > 0 && parsed[i - 1].newRating != null
              ? parsed[i - 1].newRating
              : 0;
      }
      parsed[i].ratingDelta = parsed[i].newRating != null
          ? parsed[i].newRating - parsed[i].oldRating
          : null;
  }
  
  return parsed;
}

function parseContestRankCards(html) {
  const $ = cheerio.load(html);
  const ranks = {};

  $('a[href*="/rankings/"], a[href*="/ratings/"], tr, .contest-name, .rating-table__contest').each((_, element) => {
    const node = $(element);
    const text = cleanText(node.text());
    if (!/global\s+rank|rank\s*:/i.test(text)) return;

    const rank = toNumber(
      text.match(/global\s+rank\s*:?\s*([\d,]+)/i)?.[1]
      || text.match(/rank\s*:?\s*([\d,]+)/i)?.[1]
    );
    if (!rank) return;

    const href = node.attr('href') || node.find('a[href*="/rankings/"], a[href*="/ratings/"]').first().attr('href') || '';
    const contestCode = cleanText(href.match(/(?:rankings|ratings)\/([A-Z0-9_]+)/i)?.[1]).toLowerCase();
    const contestName = cleanText(
      node.find('a').first().text()
      || text.replace(/global\s+rank\s*:?\s*[\d,]+/ig, '').replace(/rank\s*:?\s*[\d,]+/ig, '')
    ).toLowerCase();

    if (contestCode) ranks[contestCode] = rank;
    if (contestName) ranks[contestName] = rank;
  });

  return ranks;
}

function textAfterLabel($, labels) {
  const labelRegex = new RegExp(`^(${labels.join('|')})\\s*:?(.*)$`, 'i');

  let found = null;
  $('*').each((_, element) => {
    if (found) return;
    const text = cleanText($(element).text());
    const match = text.match(labelRegex);
    if (!match) return;

    const sameNode = cleanText(match[2]);
    const sibling = cleanText($(element).next().text());
    found = sameNode || sibling || null;
  });

  return found;
}

function parseSolvedProblemCodes($) {
  const codes = new Set();

  $('a[href*="/problems/"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const match = href.match(/\/problems\/([A-Z0-9_]+)/i);
    if (match) codes.add(match[1].toUpperCase());
  });

  return Array.from(codes);
}

function parseProfile(html, requestedHandle, settings = null) {
  const $ = cheerio.load(html);
  const handle = cleanText(settings?.currentUser)
    || cleanText($('title').text().match(/^([^\s]+)\s+-\s+CodeChef/i)?.[1])
    || requestedHandle;
  const currentRating = toNumber($('.rating-number').first().text());
  const maximumRating = toNumber($('.rating-header small, .rating-header .rating').first().text());
  const stars = cleanText($('.rating-star, .rating-stars').first().text());
  const ranks = $('.rating-ranks a, .rating-ranks strong, .rating-ranks li')
    .map((_, element) => cleanText($(element).text()))
    .get();
  const globalRank = toNumber(ranks.find((item) => /global/i.test(item)) || ranks[0]);
  const countryRank = toNumber(ranks.find((item) => /country/i.test(item)) || ranks[1]);
  const institution = textAfterLabel($, ['Institution'])
    || cleanText($('.user-details ul li:contains("Institution") span, .user-details li:contains("Institution")').first().text());
  const country = textAfterLabel($, ['Country'])
    || cleanText($('.user-country-name, .user-details li:contains("Country") span').first().text());
  const solvedProblemCodes = parseSolvedProblemCodes($);
  const totalProblemsSolved = toNumber(
    $('h3,h4,h5').filter((_, element) => /total problems solved/i.test($(element).text())).first().text()
  ) || solvedProblemCodes.length || toNumber(textAfterLabel($, ['Total Problems Solved', 'Problems Solved']));

  return {
    handle,
    currentRating,
    maximumRating,
    stars,
    globalRank,
    countryRank,
    institution: institution || null,
    country: country || null,
    totalProblemsSolved,
    solvedProblemCodes
  };
}

function submissionIdFrom($, row, problemCode, submittedAt, rowIndex) {
  const linkHref = row.find('a[href*="/viewsolution/"], a[href*="/status/"]').first().attr('href') || '';
  const match = linkHref.match(/(?:viewsolution|status)\/([A-Z0-9_]+)/i);
  if (match) return match[1];

  return `codechef-${problemCode || 'submission'}-${submittedAt || 'unknown'}-${rowIndex + 1}`;
}

function normalizeVerdict(value) {
  const text = cleanText(value);
  if (/^accepted$/i.test(text) || /^ac$/i.test(text)) return 'OK';
  if (!text) return 'UNKNOWN';
  return text.toUpperCase();
}

function parseRecentSubmissions(html) {
  const $ = cheerio.load(html);
  const submissions = [];

  $('tr').each((rowIndex, element) => {
    const row = $(element);
    const cells = row.find('td').map((_, cell) => cleanText($(cell).text())).get();
    if (cells.length < 3) return;

    const links = row.find('a').map((_, link) => ({
      text: cleanText($(link).text()),
      href: $(link).attr('href') || ''
    })).get();
    const problemLink = links.find((link) => /\/problems\//i.test(link.href));
    const problemHref = problemLink?.href || '';
    const problemCode = problemLink?.href.match(/\/problems\/([A-Z0-9_]+)/i)?.[1]?.toUpperCase()
      || cleanText(problemLink?.text)
      || cells.find((cell) => /^[A-Z0-9_]{2,}$/.test(cell));
    const contestKey = problemHref.match(/\/([^/]+)\/problems\/[A-Z0-9_]+/i)?.[1]?.toUpperCase() || null;

    const statusCell = row.find('td').eq(2);
    const statusTitle = statusCell.find('span[title]').first().attr('title');
    const verdict = normalizeVerdict(statusTitle || statusCell.attr('title') || statusCell.text());
    const language = cells.find((cell) => /(C\+\+|JAVA|PYTHON|PYPY|C#|RUBY|GO|RUST|KOTLIN|JAVASCRIPT|NODE|PHP|C$)/i.test(cell)) || null;
    const timeCell = row.find('td').first().attr('title') || cells.find((cell) => codeChefTimestampSeconds(cell)) || null;
    const submittedAt = codeChefTimestampSeconds(timeCell);

    if (!problemCode || !submittedAt) return;

    submissions.push({
      id: submissionIdFrom($, row, problemCode, submittedAt, rowIndex),
      problem: {
        name: cleanText(problemLink?.text) || problemCode,
        slug: problemCode,
        contestId: contestKey,
        rating: null,
        tags: []
      },
      verdict,
      language,
      creationTimeSeconds: submittedAt
    });
  });

  return submissions;
}

async function cachedHtml(cacheKey, path, params) {
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached?.html) return cached.html;

  try {
    const response = await client.get(path, { params });
    const html = typeof response.data === 'string' ? response.data : response.data?.content;
    if (response.status < 200 || response.status >= 300 || typeof html !== 'string') {
      throw new CodeChefError(`CodeChef returned an unexpected response for ${path}`);
    }
    await setJson(cacheKey, { html }, CACHE_TTL_SECONDS).catch(() => {});
    return html;
  } catch (error) {
    if (error instanceof CodeChefError) throw error;
    const status = error.response?.status;
    const suffix = status ? ` (HTTP ${status})` : '';
    throw new CodeChefError(`CodeChef is unavailable or rejected the request${suffix}`, error);
  }
}

async function cachedRecentPage(handle, page) {
  const normalizedHandle = handle.toLowerCase();
  const cached = await getJson(`upstream:codechef:recent-page:${normalizedHandle}:${page}`).catch(() => null);
  if (cached?.html) return cached;

  try {
    const response = await client.get('/recent/user', {
      params: { user_handle: handle, page }
    });
    const html = typeof response.data === 'string' ? response.data : response.data?.content;
    if (response.status < 200 || response.status >= 300 || typeof html !== 'string') {
      throw new CodeChefError(`CodeChef returned an unexpected response for recent page ${page}`);
    }

    const payload = {
      html,
      maxPage: Math.max(1, Number(response.data?.max_page || page || 1))
    };
    await setJson(`upstream:codechef:recent-page:${normalizedHandle}:${page}`, payload, CACHE_TTL_SECONDS).catch(() => {});
    return payload;
  } catch (error) {
    if (error instanceof CodeChefError) throw error;
    const status = error.response?.status;
    const suffix = status ? ` (HTTP ${status})` : '';
    throw new CodeChefError(`CodeChef recent activity is unavailable${suffix}`, error);
  }
}

async function getAllRecentSubmissions(handle) {
  const firstPage = await cachedRecentPage(handle, 1);
  const pages = [firstPage.html];
  const maxPage = Math.max(1, Math.min(firstPage.maxPage || 1, 100));

  for (let page = 2; page <= maxPage; page += 1) {
    const pageData = await cachedRecentPage(handle, page);
    pages.push(pageData.html);
  }

  const seen = new Set();
  return pages
    .flatMap(parseRecentSubmissions)
    .filter((submission) => {
      if (!submission.id || seen.has(submission.id)) return false;
      seen.add(submission.id);
      return true;
    });
}

async function getPublicProfile(handle) {
  const normalizedHandle = handle.toLowerCase();
  const profileHtml = await cachedHtml(`upstream:codechef:profile-html:${normalizedHandle}`, `/users/${encodeURIComponent(handle)}`);

  const settings = findDrupalSettings(profileHtml);
  const profile = parseProfile(profileHtml, handle, settings);
  const heatmap = parseHeatmap(profileHtml);
  const contests = parseContestHistory(profileHtml);
  const submissions = await getAllRecentSubmissions(handle);

  return {
    profile,
    contests,
    submissions,
    heatmap,
    stats: {
      totalProblemsSolved: profile.totalProblemsSolved || 0,
      contestCount: contests.length,
      currentRating: profile.currentRating,
      maximumRating: profile.maximumRating,
      globalRank: profile.globalRank,
      countryRank: profile.countryRank
    }
  };
}

module.exports = { getPublicProfile, CodeChefError };
