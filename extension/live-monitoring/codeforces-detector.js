export function detectCodeforcesContest(urlValue) {
  if (!urlValue) return { supported: false, reason: 'missing_url' };
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return { supported: false, reason: 'invalid_url' };
  }
  if (!url.hostname.endsWith('codeforces.com')) return { supported: false, reason: 'unsupported_host' };
  const match = url.pathname.match(/^\/(?:contest|gym)\/(\d+)(?:\/problem\/([A-Z]\d?|[A-Z][0-9A-Z]*))?/i);
  if (!match) return { supported: false, reason: 'unsupported_page' };
  return {
    supported: true,
    platform: 'codeforces',
    contestId: match[1],
    problemId: match[2] || null,
    contestName: `Codeforces ${url.pathname.startsWith('/gym/') ? 'Gym' : 'Contest'} ${match[1]}`,
    contestUrl: `${url.origin}${match[0].split('/problem/')[0]}`,
    pageUrl: url.href,
    contestType: url.pathname.startsWith('/gym/') ? 'gym' : 'contest'
  };
}
