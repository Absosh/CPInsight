export const LeetCodeGraphQLOperation = Object.freeze({
  GLOBAL_DATA: 'globalData',
  USER_PROFILE: 'userProfile',
  RECENT_AC_SUBMISSIONS: 'recentAcSubmissions',
  RECENT_SUBMISSIONS: 'recentSubmissions',
  USER_CONTESTS: 'userContests',
  PROBLEM_METADATA: 'problemMetadata',
  USER_PROGRESS_QUESTION_LIST: 'userProgressQuestionList',
  FAVORITES: 'favorites'
});

export const LeetCodeGraphQLQueries = Object.freeze({
  [LeetCodeGraphQLOperation.GLOBAL_DATA]: {
    operationName: 'globalData',
    query: `
      query globalData {
        userStatus {
          isSignedIn
          username
          realName
          avatar
          userSlug
        }
      }
    `,
    variables: () => ({})
  },
  [LeetCodeGraphQLOperation.USER_PROFILE]: {
    operationName: 'getUserProfile',
    query: `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            userAvatar
            ranking
            reputation
            websites
            countryName
            company
            school
            skillTags
            aboutMe
          }
          languageProblemCount {
            languageName
            problemsSolved
          }
          badges {
            id
            displayName
            icon
          }
          submissionCalendar
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
            totalSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
      }
    `,
    variables: ({ username }) => ({ username })
  },
  [LeetCodeGraphQLOperation.RECENT_AC_SUBMISSIONS]: {
    operationName: 'recentAcSubmissions',
    query: `
      query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `,
    variables: ({ username, limit = 50 }) => ({ username, limit })
  },
  [LeetCodeGraphQLOperation.RECENT_SUBMISSIONS]: {
    operationName: 'recentSubmissions',
    query: `
      query recentSubmissions($username: String!, $limit: Int!) {
        recentSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
          statusDisplay
          lang
          runtime
          memory
        }
      }
    `,
    variables: ({ username, limit = 50 }) => ({ username, limit })
  },
  [LeetCodeGraphQLOperation.USER_CONTESTS]: {
    operationName: 'userContests',
    query: `
      query userContests($username: String!) {
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
          totalParticipants
          topPercentage
          badge {
            name
          }
        }
        userContestRankingHistory(username: $username) {
          attended
          trendDirection
          problemsSolved
          totalProblems
          finishTimeInSeconds
          rating
          ranking
          contest {
            title
            startTime
          }
        }
      }
    `,
    variables: ({ username }) => ({ username })
  },
  [LeetCodeGraphQLOperation.PROBLEM_METADATA]: {
    operationName: 'problemMetadata',
    query: `
      query problemMetadata($limit: Int!, $skip: Int!, $filters: QuestionListFilterInput) {
        problemsetQuestionList(categorySlug: "", limit: $limit, skip: $skip, filters: $filters) {
          total
          questions {
            title
            titleSlug
            difficulty
            acRate
            isPaidOnly
            topicTags {
              name
              slug
            }
          }
        }
      }
    `,
    variables: ({ limit = 100, skip = 0, filters = {} } = {}) => ({ limit, skip, filters })
  },
  [LeetCodeGraphQLOperation.USER_PROGRESS_QUESTION_LIST]: {
    operationName: 'userProgressQuestionList',
    query: `
      query userProgressQuestionList($filters: UserProgressQuestionListInput) {
        userProgressQuestionList(filters: $filters) {
          totalNum
          questions {
            frontendId
            title
            translatedTitle
            titleSlug
            difficulty
            lastSubmittedAt
            numSubmitted
            questionStatus
            lastResult
            topicTags {
              name
              slug
            }
          }
        }
      }
    `,
    variables: ({
      skip = 0,
      limit = 50,
      sortField = 'LAST_SUBMITTED_AT',
      sortOrder = 'DESCENDING'
    } = {}) => ({
      filters: {
        skip,
        limit,
        sortField,
        sortOrder
      }
    })
  },
  [LeetCodeGraphQLOperation.FAVORITES]: {
    operationName: 'myFavoriteList',
    query: `
      query myFavoriteList {
        myCreatedFavoriteList {
          favorites {
            name
            slug
          }
        }
      }
    `,
    variables: () => ({})
  }
});
