import { ProviderId } from '../constants/provider-ids.js';

export const ProviderConfig = Object.freeze({
  [ProviderId.LEETCODE]: {
    id: ProviderId.LEETCODE,
    displayName: 'LeetCode',
    matches: ['https://leetcode.com/*'],
    enabled: true
  },
  [ProviderId.CODEFORCES]: {
    id: ProviderId.CODEFORCES,
    displayName: 'Codeforces',
    matches: ['https://codeforces.com/*'],
    enabled: false
  },
  [ProviderId.CODECHEF]: {
    id: ProviderId.CODECHEF,
    displayName: 'CodeChef',
    matches: ['https://www.codechef.com/*'],
    enabled: false
  }
});
