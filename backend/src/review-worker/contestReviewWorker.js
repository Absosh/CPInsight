const crypto = require('crypto');
const pool = require('../database/pool');
const liveTelemetryRepository = require('../repositories/liveTelemetryRepository');
const reviewRepository = require('../repositories/contestReviewRepository');
const { ContestReviewPipeline } = require('./reviewPipeline');
const { ReviewRetryPolicy } = require('./retryPolicy');
const { ReviewEventPublisher } = require('./reviewEventPublisher');
const { reviewWorkerConfig } = require('./config');
const { REVIEW_JOB_STATES, REVIEW_JOB_PROGRESS, REVIEW_EVENT_TYPES } = require('./jobStates');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ContestReviewWorker {
  constructor({
    config = reviewWorkerConfig(),
    repository = reviewRepository,
    liveRepository = liveTelemetryRepository,
    pipeline = new ContestReviewPipeline(),
    retryPolicy = new ReviewRetryPolicy(),
    eventPublisher = new ReviewEventPublisher(),
    logger = console,
    workerId = `review-worker-${crypto.randomUUID()}`
  } = {}) {
    this.config = config;
    this.repository = repository;
    this.liveRepository = liveRepository;
    this.pipeline = pipeline;
    this.retryPolicy = retryPolicy;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
    this.workerId = workerId;
    this.running = false;
    this.inFlight = new Set();
    this.timer = null;
    this.stats = {
      jobsClaimed: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      jobsDeadLettered: 0,
      retries: 0,
      startedAt: null
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = new Date().toISOString();
    this.schedule(0);
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    while (this.inFlight.size > 0) await sleep(100);
  }

  schedule(delayMs = this.config.pollIntervalMs) {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.tick().catch((error) => {
        this.logger.warn?.('Contest review worker tick failed', { message: error.message });
      }).finally(() => this.schedule());
    }, delayMs);
  }

  async tick() {
    await this.repository.recoverExpiredLeases();
    const available = Math.max(0, this.config.concurrency - this.inFlight.size);
    if (!available) return [];
    const jobs = await this.repository.claimNextJobs({
      workerId: this.workerId,
      limit: Math.min(available, this.config.batchSize),
      leaseMs: this.config.leaseMs,
      retryLimit: this.config.retryLimit
    });
    await this.repository.insertMetric({
      metricName: 'review_worker.queue_depth_sample',
      metricValue: { claimed: jobs.length, available },
      workerId: this.workerId
    }).catch(() => {});
    for (const job of jobs) {
      this.stats.jobsClaimed += 1;
      const promise = this.processJob(job)
        .catch((error) => this.logger.warn?.('Contest review job failed', { jobId: job.id, message: error.message }))
        .finally(() => this.inFlight.delete(promise));
      this.inFlight.add(promise);
    }
    return jobs;
  }

  async processJob(claimedJob) {
    let job = claimedJob;
    await this.eventPublisher.publish(REVIEW_EVENT_TYPES.CLAIMED, job, { workerId: this.workerId }).catch(() => {});
    try {
      job = await this.updateStage(job, REVIEW_JOB_STATES.RUNNING, REVIEW_JOB_PROGRESS[REVIEW_JOB_STATES.RUNNING], {
        workerId: this.workerId
      });
      const session = await this.repository.getLiveSessionByJob(job.id);
      if (!session) throw new Error(`Live telemetry session not found for review job ${job.id}`);

      const output = await this.pipeline.run({
        userId: job.user_id,
        session,
        providerTimeoutMs: this.config.providerTimeoutMs,
        updateStage: ({ stage, progressPercent, metadata }) => this.updateStage(job, stage, progressPercent, metadata)
      });

      job = await this.updateStage(job, REVIEW_JOB_STATES.PERSIST, REVIEW_JOB_PROGRESS[REVIEW_JOB_STATES.PERSIST], {
        validationId: output.validation.validationId
      });
      const review = await this.persistReview({ job, session, output });
      const completed = await this.repository.completeJob(job, {
        reviewId: review.id,
        result: {
          reviewId: review.id,
          validationId: output.validation.validationId,
          qualityScore: output.validation.qualityReport?.overallQualityScore || 0
        }
      });
      await this.liveRepository.updateSession(session.live_session_id, {
        state: 'completed',
        connectionStatus: 'stopped',
        statistics: { reviewId: review.id, reviewCompletedAt: new Date().toISOString() }
      });
      this.stats.jobsCompleted += 1;
      await this.repository.insertMetric({
        metricName: 'review_worker.job_completed',
        metricValue: { jobId: job.id, reviewId: review.id },
        workerId: this.workerId
      }).catch(() => {});
      await this.eventPublisher.publish(REVIEW_EVENT_TYPES.COMPLETED, completed || job, { reviewId: review.id }).catch(() => {});
      await this.eventPublisher.publish(REVIEW_EVENT_TYPES.READY, completed || job, { reviewId: review.id }).catch(() => {});
      return review;
    } catch (error) {
      await this.handleFailure(job, error);
      throw error;
    }
  }

  async updateStage(job, stage, progressPercent, metadata = {}) {
    const updated = await this.repository.markStage(job, {
      stage,
      progressPercent,
      metadata,
      message: stage === REVIEW_JOB_STATES.RUNNING ? 'Contest review worker started' : null
    });
    const eventType = stage === REVIEW_JOB_STATES.RUNNING ? REVIEW_EVENT_TYPES.PROCESSING : REVIEW_EVENT_TYPES.PROGRESS;
    await this.eventPublisher.publish(eventType, updated || job, {
      stage,
      progressPercent,
      metadata
    }).catch(() => {});
    return updated || { ...job, status: stage, progress_percent: progressPercent, last_stage: stage };
  }

  async persistReview({ job, session, output }) {
    const validation = output.validation;
    const title = `Contest Review: ${session.contest_name || session.contest_id}`;
    const review = await this.repository.insertReview({
      liveSessionId: session.live_session_id,
      userId: job.user_id,
      contestId: session.contest_id,
      platform: session.platform,
      title,
      summary: validation.validatedResponse?.summary || null,
      validatedResponse: validation.validatedResponse,
      qualityReport: validation.qualityReport,
      reasoningContext: output.reasoningContext,
      evidencePackage: output.evidencePackage,
      recommendations: validation.validatedResponse?.recommendations || [],
      roadmap: output.roadmap,
      reflections: validation.behaviorReflections,
      metadata: {
        question: output.question,
        behaviorRunId: output.behavior.runId,
        knowledgeRunId: output.knowledge.runId,
        executionPlanId: output.executionPlan.executionPlanId,
        runtimeRequestId: output.runtime.runtimeRequestId
      }
    });
    await this.repository.insertRoadmapUpdate({
      userId: job.user_id,
      liveSessionId: session.live_session_id,
      reviewId: review.id,
      roadmap: output.roadmap,
      recommendationTracking: output.recommendationTracking,
      behaviorEvolution: output.behaviorEvolution
    });
    return review;
  }

  async handleFailure(job, error) {
    const nextRetry = Number(job.retry_count || 0) + 1;
    const nextAttemptAt = this.retryPolicy.nextAttemptAt(nextRetry);
    const result = await this.repository.failJob(job, error, {
      retryLimit: this.config.retryLimit,
      nextAttemptAt
    });
    this.stats.jobsFailed += 1;
    if (result.exhausted) {
      this.stats.jobsDeadLettered += 1;
      await this.eventPublisher.publish(REVIEW_EVENT_TYPES.FAILED, result.job || job, {
        final: true,
        errorMessage: error.message
      }).catch(() => {});
    } else {
      this.stats.retries += 1;
      await this.eventPublisher.publish(REVIEW_EVENT_TYPES.RETRYING, result.job || job, {
        retryCount: result.retryCount,
        nextAttemptAt: result.job?.next_attempt_at || nextAttemptAt
      }).catch(() => {});
    }
    await this.repository.insertMetric({
      metricName: result.exhausted ? 'review_worker.job_dead_lettered' : 'review_worker.job_retrying',
      metricValue: { jobId: job.id, errorMessage: error.message, retryCount: result.retryCount },
      workerId: this.workerId
    }).catch(() => {});
  }
}

module.exports = { ContestReviewWorker };
