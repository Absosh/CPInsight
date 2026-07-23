const { createDomainEvent } = require('../domain-events/domainEvent');
const outboxRepository = require('../domain-events/outbox/repository');

class ReviewEventPublisher {
  constructor({ repository = outboxRepository, source = 'contest-review-worker' } = {}) {
    this.repository = repository;
    this.source = source;
  }

  async publish(eventType, job, payload = {}, db = undefined) {
    const event = createDomainEvent({
      eventType,
      aggregateType: 'ContestReviewJob',
      aggregateId: job.id,
      source: this.source,
      payload: {
        jobId: job.id,
        liveSessionId: job.live_session_id,
        userId: job.user_id,
        status: job.status,
        progressPercent: job.progress_percent || 0,
        ...payload
      },
      metadata: {
        channelHints: [
          `user:${job.user_id}`,
          `telemetry:${job.user_id}`,
          job.contest_id ? `contest:${job.contest_id}` : null
        ].filter(Boolean)
      },
      correlationId: job.id
    });
    return this.repository.insert(event, db);
  }
}

module.exports = { ReviewEventPublisher };
