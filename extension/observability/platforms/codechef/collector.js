import { ContestStatus, PageKind } from '../../models/page-context.js';
import { parseDateTime, readMetaContent, textContent } from '../shared/dom-utils.js';

const HOST_PATTERN = /(^|\.)codechef\.com$/i;

function parseCodeChefUrl(url) {
  const parsed = new URL(url);
  if (!HOST_PATTERN.test(parsed.hostname)) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  const contestRootIndex = parts.findIndex((part) => part.toUpperCase() === 'STARTERS' || part.toLowerCase() === 'contests');
  const directContestSlug = contestRootIndex === -1 ? parts[0] : null;
  if ((contestRootIndex === -1 && !directContestSlug) || (contestRootIndex !== -1 && !parts[contestRootIndex + 1])) return null;
  const contestId = (directContestSlug || parts[contestRootIndex + 1]).toUpperCase();
  const problemMarkerIndex = parts.findIndex((part) => part.toLowerCase() === 'problems');
  const problemCode = problemMarkerIndex !== -1 ? parts[problemMarkerIndex + 1]?.toUpperCase() || null : null;
  return {
    contestId,
    problemCode,
    kind: problemCode ? PageKind.PROBLEM : PageKind.CONTEST,
    contestType: contestId.startsWith('START') ? 'starters' : 'contest'
  };
}

function detectStatus(documentRef, endTime) {
  const lowerBody = documentRef.body?.textContent?.toLowerCase() || '';
  if (endTime && Date.now() > Date.parse(endTime)) return ContestStatus.FINISHED;
  if (lowerBody.includes('contest ended') || lowerBody.includes('ended')) return ContestStatus.FINISHED;
  if (lowerBody.includes('starts in')) return ContestStatus.UPCOMING;
  return ContestStatus.ACTIVE;
}

export const codechefCollector = Object.freeze({
  id: 'codechef-contest-session',
  platform: 'codechef',

  async initialize() {},

  supports(url) {
    try {
      return Boolean(parseCodeChefUrl(url));
    } catch {
      return false;
    }
  },

  collect({ url, documentRef }) {
    const parsed = parseCodeChefUrl(url);
    if (!parsed) {
      return {
        platform: this.platform,
        kind: PageKind.UNSUPPORTED
      };
    }
    const contestName = textContent(documentRef, [
      '[data-testid="contest-name"]',
      '.contest-name',
      'h1',
      'title'
    ]);
    const contestStartTime = parseDateTime(
      readMetaContent(documentRef, ['contest:start_time', 'start_time']) ||
      documentRef.querySelector('[data-contest-start-time]')?.getAttribute('data-contest-start-time')
    );
    const contestEndTime = parseDateTime(
      readMetaContent(documentRef, ['contest:end_time', 'end_time']) ||
      documentRef.querySelector('[data-contest-end-time]')?.getAttribute('data-contest-end-time')
    );
    return {
      platform: this.platform,
      kind: parsed.kind,
      contestId: parsed.contestId,
      contestName,
      contestType: parsed.contestType,
      contestStartTime,
      contestEndTime,
      contestStatus: detectStatus(documentRef, contestEndTime),
      problemCode: parsed.problemCode,
      problemIndex: parsed.problemCode,
      metadata: {
        routePattern: parsed.kind === PageKind.PROBLEM ? '/:contest/problems/:code' : '/:contest'
      }
    };
  },

  pause() {},

  resume() {},

  destroy() {}
});
