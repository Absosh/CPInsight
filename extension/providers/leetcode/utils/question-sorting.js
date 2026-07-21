const difficultyWeight = Object.freeze({
  easy: 1,
  medium: 2,
  hard: 3
});

function numericFrontendId(question) {
  const value = Number(question.frontendId);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function time(question) {
  return Date.parse(question.lastSolvedAt) || 0;
}

export const QuestionSort = Object.freeze({
  lastSubmitted(questions, direction = 'desc') {
    return questions.slice().sort((a, b) => direction === 'asc' ? time(a) - time(b) : time(b) - time(a));
  },

  difficulty(questions, direction = 'asc') {
    return questions.slice().sort((a, b) => {
      const delta = (difficultyWeight[a.difficulty] || 0) - (difficultyWeight[b.difficulty] || 0);
      return direction === 'desc' ? -delta : delta;
    });
  },

  submissionCount(questions, direction = 'desc') {
    return questions.slice().sort((a, b) => (
      direction === 'asc'
        ? a.submissionCount - b.submissionCount
        : b.submissionCount - a.submissionCount
    ));
  },

  frontendId(questions, direction = 'asc') {
    return questions.slice().sort((a, b) => (
      direction === 'desc'
        ? numericFrontendId(b) - numericFrontendId(a)
        : numericFrontendId(a) - numericFrontendId(b)
    ));
  },

  alphabetical(questions, direction = 'asc') {
    return questions.slice().sort((a, b) => (
      direction === 'desc'
        ? String(b.title || '').localeCompare(String(a.title || ''))
        : String(a.title || '').localeCompare(String(b.title || ''))
    ));
  },

  recentSolves(questions) {
    return this.lastSubmitted(
      questions.filter((question) => ['ac', 'accepted', 'solved'].includes(question.solvedStatus)),
      'desc'
    );
  }
});
