const DAY_MS = 24 * 60 * 60 * 1000;

function isSolved(question) {
  return ['ac', 'accepted', 'solved'].includes(question.solvedStatus) ||
    ['AC', 'Accepted'].includes(question.latestResult);
}

function submittedSince(question, since) {
  if (!question.lastSolvedAt) return false;
  const timestamp = Date.parse(question.lastSolvedAt);
  return Number.isFinite(timestamp) && timestamp >= since.getTime();
}

function byLastSolvedDesc(a, b) {
  return (Date.parse(b.lastSolvedAt) || 0) - (Date.parse(a.lastSolvedAt) || 0);
}

export function computeQuestionAnalytics(questions, now = new Date()) {
  const solved = questions.filter(isSolved);
  const last30Days = new Date(now.getTime() - 30 * DAY_MS);
  const lastYear = new Date(now.getTime() - 365 * DAY_MS);
  const topicFrequency = new Map();
  const submissionCountDistribution = new Map();
  const questionStatusDistribution = new Map();

  for (const question of questions) {
    questionStatusDistribution.set(
      question.solvedStatus,
      (questionStatusDistribution.get(question.solvedStatus) || 0) + 1
    );

    const bucket = String(question.submissionCount);
    submissionCountDistribution.set(bucket, (submissionCountDistribution.get(bucket) || 0) + 1);

    for (const topic of question.topics) {
      const key = topic.name || topic.slug || topic.translatedName;
      if (key) topicFrequency.set(key, (topicFrequency.get(key) || 0) + 1);
    }
  }

  const topicFrequencyList = Array.from(topicFrequency.entries())
    .map(([topic, count]) => Object.freeze({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  return Object.freeze({
    totalSolved: solved.length,
    solvedLast30Days: solved.filter((question) => submittedSince(question, last30Days)).length,
    solvedLastYear: solved.filter((question) => submittedSince(question, lastYear)).length,
    easySolved: solved.filter((question) => question.difficulty === 'easy').length,
    mediumSolved: solved.filter((question) => question.difficulty === 'medium').length,
    hardSolved: solved.filter((question) => question.difficulty === 'hard').length,
    topicFrequency: Object.freeze(topicFrequencyList),
    mostSolvedTopics: Object.freeze(topicFrequencyList.slice(0, 10)),
    recentlySolvedProblems: Object.freeze(solved.slice().sort(byLastSolvedDesc).slice(0, 25)),
    submissionCountDistribution: Object.freeze(Object.fromEntries(submissionCountDistribution)),
    questionStatusDistribution: Object.freeze(Object.fromEntries(questionStatusDistribution))
  });
}
