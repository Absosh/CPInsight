import { ProviderId } from '../../../constants/provider-ids.js';

export function detectLeetCodePageState(location = window.location) {
  const profileMatch = location.pathname.match(/^\/u\/([^/]+)\/?$/);
  const isProgressPage = location.pathname === '/progress' || location.pathname === '/progress/';

  return {
    providerId: ProviderId.LEETCODE,
    url: location.href,
    pathname: location.pathname,
    isProviderPage: location.hostname.endsWith('leetcode.com'),
    isSupportedCollectionPage: Boolean(profileMatch || isProgressPage),
    pageKind: profileMatch ? 'profile' : isProgressPage ? 'progress' : 'other',
    username: profileMatch ? decodeURIComponent(profileMatch[1]) : null
  };
}
