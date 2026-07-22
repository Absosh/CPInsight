import { ContestStatus, PageKind } from '../../models/page-context.js';
import { parseDateTime, readMetaContent, textContent } from '../shared/dom-utils.js';

const HOST_PATTERN = /(^|\.)codeforces\.com$/i;

function parseCodeforcesUrl(url) {
  const parsed = new URL(url);
  if (!HOST_PATTERN.test(parsed.hostname)) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  const contestRootIndex = parts.findIndex((part) => part === 'contest' || part === 'gym');
  if (contestRootIndex === -1 || !parts[contestRootIndex + 1]) return null;
  const contestId = parts[contestRootIndex + 1];
  const problemIndex = parts[contestRootIndex + 2] === 'problem' ? parts[contestRootIndex + 3] || null : null;
  return {
    contestId,
    problemIndex,
    kind: problemIndex ? PageKind.PROBLEM : PageKind.CONTEST,
    contestType: parts[contestRootIndex] === 'gym' ? 'gym' : 'contest'
  };
}

function detectStatus(documentRef, endTime) {
  const lowerBody = documentRef.body?.textContent?.toLowerCase() || '';
  if (endTime && Date.now() > Date.parse(endTime)) return ContestStatus.FINISHED;
  if (lowerBody.includes('contest is over') || lowerBody.includes('final standings')) return ContestStatus.FINISHED;
  if (lowerBody.includes('before contest')) return ContestStatus.UPCOMING;
  return ContestStatus.ACTIVE;
}

export const codeforcesCollector = Object.freeze({
  id: 'codeforces-contest-session',
  platform: 'codeforces',

  async initialize() {},

  supports(url) {
    try {
      return Boolean(parseCodeforcesUrl(url));
    } catch {
      return false;
    }
  },

  collect({ url, documentRef }) {
    const parsed = parseCodeforcesUrl(url);
    if (!parsed) {
      return {
        platform: this.platform,
        kind: PageKind.UNSUPPORTED
      };
    }
    const contestName = textContent(documentRef, [
      '.contest-name',
      '.rtable th.left',
      '.datatable .left',
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
      problemCode: parsed.problemIndex || null,
      problemIndex: parsed.problemIndex || null,
      metadata: {
        routePattern: parsed.kind === PageKind.PROBLEM ? '/contest/:id/problem/:index' : '/contest/:id'
      }
    };
  },

  pause() {},

  resume() {},

  destroy() {}
});
