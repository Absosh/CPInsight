function asTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export const QuestionFilters = Object.freeze({
  solvedOnly(questions) {
    return questions.filter((question) => ['ac', 'accepted', 'solved'].includes(question.solvedStatus));
  },

  attemptedOnly(questions) {
    return questions.filter((question) => question.submissionCount > 0);
  },

  byDifficulty(questions, difficulty) {
    const normalized = String(difficulty || '').toLowerCase();
    return questions.filter((question) => question.difficulty === normalized);
  },

  byDateRange(questions, { from = null, to = null } = {}) {
    const fromTime = from ? asTime(from) : null;
    const toTime = to ? asTime(to) : null;
    return questions.filter((question) => {
      const time = asTime(question.lastSolvedAt);
      if (time === null) return false;
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
      return true;
    });
  },

  byTopic(questions, topic) {
    const needle = String(topic || '').toLowerCase();
    return questions.filter((question) => question.topics.some((item) => (
      item.name?.toLowerCase() === needle ||
      item.slug?.toLowerCase() === needle ||
      item.translatedName?.toLowerCase() === needle
    )));
  },

  bySubmissionCount(questions, { min = 0, max = Infinity } = {}) {
    return questions.filter((question) => question.submissionCount >= min && question.submissionCount <= max);
  },

  byStatus(questions, status) {
    const normalized = String(status || '').toLowerCase();
    return questions.filter((question) => question.solvedStatus === normalized);
  }
});
