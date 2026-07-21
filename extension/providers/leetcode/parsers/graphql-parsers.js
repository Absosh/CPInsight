import { LeetCodeGraphQLOperation } from '../graphql/queries.js';
import { optionalArray, optionalObject } from '../validators/schema.js';

export const LeetCodeGraphQLParsers = Object.freeze({
  [LeetCodeGraphQLOperation.GLOBAL_DATA](data) {
    return optionalObject(data.userStatus) || {};
  },

  [LeetCodeGraphQLOperation.USER_PROFILE](data) {
    return {
      matchedUser: optionalObject(data.matchedUser),
      publicProfile: null
    };
  },

  [LeetCodeGraphQLOperation.RECENT_AC_SUBMISSIONS](data) {
    return optionalArray(data.recentAcSubmissionList);
  },

  [LeetCodeGraphQLOperation.RECENT_SUBMISSIONS](data) {
    return optionalArray(data.recentSubmissionList);
  },

  [LeetCodeGraphQLOperation.USER_CONTESTS](data) {
    return {
      ranking: optionalObject(data.userContestRanking) || {},
      history: optionalArray(data.userContestRankingHistory)
    };
  },

  [LeetCodeGraphQLOperation.PROBLEM_METADATA](data) {
    const problemset = optionalObject(data.problemsetQuestionList) || {};
    return {
      total: Number(problemset.total) || 0,
      questions: optionalArray(problemset.questions)
    };
  },

  [LeetCodeGraphQLOperation.USER_PROGRESS_QUESTION_LIST](data) {
    const progress = optionalObject(data.userProgressQuestionList) || {};
    return {
      totalNum: Number(progress.totalNum) || 0,
      questions: optionalArray(progress.questions)
    };
  },

  [LeetCodeGraphQLOperation.FAVORITES](data) {
    return optionalArray(data.myCreatedFavoriteList?.favorites);
  }
});
