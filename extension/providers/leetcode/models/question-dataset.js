import { computeQuestionAnalytics } from '../normalizers/question-analytics.js';

function freezeQuestions(questions) {
  return Object.freeze(questions.map((question) => Object.freeze(question)));
}

export function createQuestionDataset({ questions, totalNum, pagesCollected, collectedAt = new Date().toISOString() }) {
  const frozenQuestions = freezeQuestions(questions);

  return Object.freeze({
    source: 'userProgressQuestionList',
    totalNum,
    pagesCollected,
    questions: frozenQuestions,
    analytics: computeQuestionAnalytics(frozenQuestions),
    collectedAt
  });
}
