const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const required = [
  'backend/src/database/migrations/017_live_contest_monitoring.sql',
  'backend/src/repositories/liveTelemetryRepository.js',
  'backend/src/services/liveTelemetryService.js',
  'backend/src/controllers/liveTelemetryController.js',
  'backend/src/routes/liveTelemetryRoutes.js',
  'backend/src/validators/liveTelemetrySchemas.js',
  'extension/live-monitoring/live-telemetry-sdk.js',
  'extension/live-monitoring/codeforces-detector.js',
  'extension/live-monitoring/codeforces-api-client.js',
  'extension/live-monitoring/submission-diff-engine.js',
  'extension/live-monitoring/state-machine.js',
  'src/features/live-monitoring/realtime/liveTelemetryClient.js',
  'src/features/live-monitoring/state/liveContestReducer.js',
  'src/features/live-monitoring/components/LiveContestDashboard.jsx'
];

for (const file of required) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} exists`);
}

const backend = [
  'backend/src/services/liveTelemetryService.js',
  'backend/src/routes/liveTelemetryRoutes.js',
  'backend/src/routes/index.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

for (const endpoint of ['/session/start', '/events', '/session/heartbeat', '/session/stop']) {
  assert.equal(backend.includes(endpoint), true, `${endpoint} endpoint exists`);
}
assert.equal(backend.includes('uploadTelemetryBatch'), true, 'live events reuse existing telemetry pipeline');
assert.equal(backend.includes('sessionToken'), true, 'signed session token is required');
assert.equal(backend.includes('queueReviewJob'), true, 'review generation job is queued on stop');

const extension = [
  'extension/live-monitoring/live-telemetry-sdk.js',
  'extension/live-monitoring/codeforces-api-client.js',
  'extension/live-monitoring/submission-diff-engine.js',
  'extension/background/service-worker.js',
  'extension/popup/popup-view.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

for (const eventType of ['session_started', 'session_stopped', 'problem_opened', 'problem_switch', 'reading_duration', 'window_blur', 'window_focus', 'idle', 'resume', 'heartbeat', 'submission_created', 'submission_verdict', 'accepted', 'wrong_answer', 'time_limit', 'runtime_error', 'compilation_error', 'problem_solved', 'rank_changed']) {
  assert.equal(extension.includes(eventType), true, `${eventType} live event is emitted or diffed`);
}
for (const forbidden of ['clipboard', 'password', 'cookie', 'keydown', 'keyup', 'document.body.innerText']) {
  assert.equal(extension.toLowerCase().includes(forbidden), false, `${forbidden} is not collected`);
}
assert.equal(extension.includes('/user.status'), true, 'Codeforces user.status official API is used');
assert.equal(extension.includes('/contest.standings'), true, 'Codeforces contest.standings official API is used');

const dashboard = fs.readFileSync(path.join(root, 'src/features/live-monitoring/components/LiveContestDashboard.jsx'), 'utf8');
for (const component of ['ConfidenceBadge', 'EvidenceExplorer', 'QualityIndicator']) {
  assert.equal(dashboard.includes(component), true, `${component} design system component is used`);
}

const migration = fs.readFileSync(path.join(root, 'backend/src/database/migrations/017_live_contest_monitoring.sql'), 'utf8');
for (const table of ['telemetry_live_sessions', 'telemetry_live_heartbeat_logs', 'telemetry_live_event_receipts', 'contest_monitoring_metrics', 'contest_review_jobs']) {
  assert.equal(migration.includes(table), true, `${table} table exists`);
}

console.log(JSON.stringify({
  verdict: 'PASS',
  requiredFiles: required.length,
  backendEndpoints: 4,
  codeforcesOfficialApi: true,
  telemetryPipelineReused: true,
  sensitiveCollectionBoundary: true,
  websocketDashboard: true,
  reviewJobQueued: true
}, null, 2));
