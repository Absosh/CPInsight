export const AiCoachSessionStatus = Object.freeze({
  active: 'active',
  archived: 'archived',
  deleted: 'deleted'
});

export const AiCoachMessageStatus = Object.freeze({
  queued: 'queued',
  streaming: 'streaming',
  completed: 'completed',
  failed: 'failed',
  aborted: 'aborted'
});

export const AiCoachView = Object.freeze({
  conversation: 'conversation',
  contestReviews: 'contestReviews',
  studyPlans: 'studyPlans',
  reflections: 'reflections',
  savedReports: 'savedReports',
  settings: 'settings'
});
