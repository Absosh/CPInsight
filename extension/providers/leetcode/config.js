import { AppConfig } from '../../config/defaults.js';

export const LeetCodeConfig = Object.freeze({
  origin: 'https://leetcode.com',
  graphqlPath: '/graphql/',
  requestTimeoutMs: AppConfig.messaging.requestTimeoutMs,
  domReadyTimeoutMs: AppConfig.messaging.requestTimeoutMs,
  progressQuestionList: Object.freeze({
    limit: 50,
    sortField: 'LAST_SUBMITTED_AT',
    sortOrder: 'DESCENDING'
  }),
  selectors: Object.freeze({
    profileLinks: [
      'a[href^="/u/"]',
      'a[href^="/profile/"]'
    ],
    avatar: [
      'img[alt*="avatar" i]',
      'img[src*="leetcode.cn"]',
      'img[src*="assets.leetcode"]'
    ],
    ranking: [
      '[data-cy="ranking"]',
      '[class*="ranking" i]'
    ]
  }),
  network: Object.freeze({
    observeFetch: true,
    observeXHR: true,
    graphqlPaths: ['/graphql', '/graphql/'],
    maxBodyPreviewLength: 200000
  })
});
