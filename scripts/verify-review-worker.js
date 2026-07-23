const fs = require('fs');
const path = require('path');
const { ReviewRetryPolicy } = require('../backend/src/review-worker/retryPolicy');
const { REVIEW_JOB_STATES, REVIEW_EVENT_TYPES } = require('../backend/src/review-worker/jobStates');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesEvery(source, values, label) {
  for (const value of values) {
    assert(source.includes(value), `${label} is missing ${value}`);
  }
}

function verifyMigration() {
  const migration = read('backend/src/database/migrations/018_contest_review_worker.sql');
  includesEvery(migration, [
    'contest_review_jobs_live_session_unique_idx',
    'contest_reviews',
    'contest_review_execution_logs',
    'contest_review_dead_letters',
    'contest_review_metrics',
    'contest_roadmap_updates'
  ], 'review worker migration');
}

function verifyRepository() {
  const repository = read('backend/src/repositories/contestReviewRepository.js');
  includesEvery(repository, [
    'claimNextJobs',
    'FOR UPDATE SKIP LOCKED',
    'recoverExpiredLeases',
    'failJob',
    'insertDeadLetter',
    'insertRoadmapUpdate',
    'statusByContest'
  ], 'review repository');
}

function verifyWorker() {
  const worker = read('backend/src/review-worker/contestReviewWorker.js');
  includesEvery(worker, [
    'processJob',
    'this.repository.claimNextJobs',
    'this.pipeline.run',
    'this.repository.completeJob',
    'this.repository.failJob',
    'REVIEW_EVENT_TYPES.READY',
    'review_worker.job_completed',
    'async stop()'
  ], 'contest review worker');
}

function verifyPipeline() {
  const pipeline = read('backend/src/review-worker/reviewPipeline.js');
  includesEvery(pipeline, [
    'this.behavior.runExtraction',
    'this.knowledge.infer',
    'this.planner.plan',
    'this.retrieval.execute',
    'this.reasoning.createContext',
    'this.reasoning.createPrompt',
    'this.task.plan',
    'this.runtime.execute',
    'this.quality.validate',
    'roadmapFromReview'
  ], 'review pipeline');
}

function verifyRoutes() {
  const routes = read('backend/src/routes/reviewRoutes.js');
  includesEvery(routes, [
    "router.get('/jobs/:id'",
    "router.get('/jobs'",
    "router.get('/latest'",
    "router.get('/status/:contestId'"
  ], 'review routes');
  const index = read('backend/src/routes/index.js');
  assert(index.includes("router.use('/api/reviews', reviewRoutes)"), 'review routes are not mounted');
}

function verifyRetryPolicy() {
  const policy = new ReviewRetryPolicy({ random: () => 0 });
  assert(policy.delayMs(1) === 1000, 'retry attempt 1 should be 1s without jitter');
  assert(policy.delayMs(2) === 2000, 'retry attempt 2 should be 2s without jitter');
  assert(policy.delayMs(3) === 4000, 'retry attempt 3 should be 4s without jitter');
  assert(policy.delayMs(6) === 30000, 'retry delay should cap at 30s');
}

function verifyStateAndEvents() {
  includesEvery(Object.values(REVIEW_JOB_STATES).join('\n'), [
    'queued',
    'claimed',
    'running',
    'behavior_processing',
    'knowledge_graph_update',
    'ai_review',
    'reflection',
    'roadmap_update',
    'persist',
    'completed',
    'retrying',
    'dead_letter'
  ], 'review job states');
  includesEvery(Object.values(REVIEW_EVENT_TYPES).join('\n'), [
    'review.job.claimed',
    'review.processing',
    'review.progress',
    'review.completed',
    'review.failed',
    'review.retrying',
    'review.ready'
  ], 'review websocket event contract');
}

function verifyServerAndScripts() {
  const server = read('backend/src/server.js');
  assert(server.includes('ContestReviewWorker'), 'API server does not start optional review worker');
  const backendPackage = read('backend/package.json');
  assert(backendPackage.includes('worker:reviews'), 'backend worker script is missing');
  const workerProcess = read('backend/src/workers/reviewWorkerProcess.js');
  assert(workerProcess.includes('await worker.stop()'), 'standalone worker process does not stop gracefully');
  const rootPackage = read('package.json');
  assert(rootPackage.includes('verify:review-worker'), 'root verification script is missing');
}

function main() {
  verifyMigration();
  verifyRepository();
  verifyWorker();
  verifyPipeline();
  verifyRoutes();
  verifyRetryPolicy();
  verifyStateAndEvents();
  verifyServerAndScripts();
  console.log('Review worker verification PASS');
}

main();
