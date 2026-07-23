const REVIEW_JOB_STATES = Object.freeze({
  QUEUED: 'queued',
  CLAIMED: 'claimed',
  RUNNING: 'running',
  BEHAVIOR_PROCESSING: 'behavior_processing',
  KNOWLEDGE_GRAPH_UPDATE: 'knowledge_graph_update',
  REASONING: 'reasoning',
  AI_REVIEW: 'ai_review',
  REFLECTION: 'reflection',
  ROADMAP_UPDATE: 'roadmap_update',
  PERSIST: 'persist',
  COMPLETED: 'completed',
  RETRYING: 'retrying',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter'
});

const REVIEW_JOB_PROGRESS = Object.freeze({
  [REVIEW_JOB_STATES.QUEUED]: 0,
  [REVIEW_JOB_STATES.CLAIMED]: 5,
  [REVIEW_JOB_STATES.RUNNING]: 10,
  [REVIEW_JOB_STATES.BEHAVIOR_PROCESSING]: 20,
  [REVIEW_JOB_STATES.KNOWLEDGE_GRAPH_UPDATE]: 35,
  [REVIEW_JOB_STATES.REASONING]: 55,
  [REVIEW_JOB_STATES.AI_REVIEW]: 75,
  [REVIEW_JOB_STATES.REFLECTION]: 90,
  [REVIEW_JOB_STATES.ROADMAP_UPDATE]: 95,
  [REVIEW_JOB_STATES.PERSIST]: 98,
  [REVIEW_JOB_STATES.COMPLETED]: 100
});

const REVIEW_EVENT_TYPES = Object.freeze({
  CLAIMED: 'review.job.claimed',
  PROCESSING: 'review.processing',
  PROGRESS: 'review.progress',
  COMPLETED: 'review.completed',
  FAILED: 'review.failed',
  RETRYING: 'review.retrying',
  READY: 'review.ready'
});

module.exports = {
  REVIEW_JOB_STATES,
  REVIEW_JOB_PROGRESS,
  REVIEW_EVENT_TYPES
};
