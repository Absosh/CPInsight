const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter'
});

module.exports = { OUTBOX_STATUS };
