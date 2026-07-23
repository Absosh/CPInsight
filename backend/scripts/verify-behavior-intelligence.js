const assert = require('assert/strict');
const crypto = require('crypto');
const { SessionReconstructor } = require('../src/behavior/reconstruction/sessionReconstructor');
const { ContestReconstructor } = require('../src/behavior/reconstruction/contestReconstructor');
const { createDefaultExtractorRegistry } = require('../src/behavior/extractors/factory');
const { BehaviorProfileAggregator } = require('../src/behavior/profile/profileAggregator');
const { BehaviorFeatureExtractor } = require('../src/behavior/extractors/extractorContract');
const { feature } = require('../src/behavior/extractors/helpers');

function telemetryEvent({
  sessionId = 'session-1',
  sequenceNumber = 1,
  eventType = 'SESSION_STARTED',
  at,
  problemId = null,
  platform = 'codeforces',
  contestId = '1999',
  eventId = crypto.randomUUID()
}) {
  return {
    id: crypto.randomUUID(),
    event_id: eventId,
    session_id: sessionId,
    platform,
    contest_id: contestId,
    contest_name: 'Verification Contest',
    problem_id: problemId,
    event_type: eventType,
    event_timestamp: at,
    page_url: `https://example.com/${contestId}/${problemId || ''}`,
    sequence_number: sequenceNumber,
    payload: {
      eventId,
      sessionId,
      platform,
      contestId,
      contestName: 'Verification Contest',
      problemId,
      eventType,
      timestamp: at,
      pageUrl: `https://example.com/${contestId}/${problemId || ''}`,
      metadata: {}
    },
    metadata: {}
  };
}

class SyntheticExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'synthetic-test', featureGroup: 'verification', version: 1 });
  }

  extract() {
    return [
      feature({
        name: 'synthetic_feature',
        group: this.featureGroup,
        value: 1,
        confidence: 0.9,
        extractorId: this.id,
        version: this.version()
      })
    ];
  }
}

function contestRows({ sessionId = 'session-1', start = Date.now(), duplicate = false, ended = true } = {}) {
  const rows = [
    telemetryEvent({ sessionId, sequenceNumber: 1, eventType: 'SESSION_STARTED', at: new Date(start).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 2, eventType: 'CONTEST_DETECTED', at: new Date(start + 1000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 3, eventType: 'PROBLEM_OPENED', problemId: 'A', at: new Date(start + 60_000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 4, eventType: 'TAB_HIDDEN', problemId: 'A', at: new Date(start + 120_000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 5, eventType: 'TAB_VISIBLE', problemId: 'A', at: new Date(start + 180_000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 6, eventType: 'PROBLEM_SWITCHED', problemId: 'B', at: new Date(start + 300_000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 7, eventType: 'SUBMISSION_MADE', problemId: 'B', at: new Date(start + 600_000).toISOString() }),
    telemetryEvent({ sessionId, sequenceNumber: 8, eventType: 'PROBLEM_SWITCHED', problemId: 'A', at: new Date(start + 900_000).toISOString() })
  ];
  if (ended) rows.push(telemetryEvent({ sessionId, sequenceNumber: 9, eventType: 'SESSION_ENDED', at: new Date(start + 1_200_000).toISOString() }));
  if (duplicate) rows.push({ ...rows[3] });
  return rows;
}

async function runExtractors(session) {
  const registry = createDefaultExtractorRegistry();
  registry.register(new SyntheticExtractor());
  const contest = new ContestReconstructor().reconstruct(session);
  const features = [];
  for (const extractor of registry.all()) {
    await extractor.initialize();
    if (extractor.supports(session, { contest })) features.push(...extractor.extract(session, { contest }));
    await extractor.destroy();
  }
  return features;
}

async function run() {
  const reconstructor = new SessionReconstructor();
  const sessions = reconstructor.reconstruct(contestRows({ duplicate: true }));
  assert.equal(sessions.length, 1);
  const session = sessions[0];
  assert.equal(session.status, 'completed');
  assert.equal(session.problemTimeline.length, 3);
  assert.equal(session.events.length, 9, 'duplicate event ids must be ignored');

  const contest = new ContestReconstructor().reconstruct(session);
  assert.equal(contest.problemSequence.length, 3);
  assert.equal(contest.attentionShifts >= 1, true);
  assert.equal(contest.idlePeriods.length >= 1, true);

  const interrupted = reconstructor.reconstruct(contestRows({ sessionId: 'interrupted', ended: false }))[0];
  assert.equal(['active', 'abandoned'].includes(interrupted.status), true);
  assert.equal(interrupted.reconstructionMetadata.incomplete, true);

  const features = await runExtractors(session);
  const names = new Set(features.map((item) => item.featureName));
  for (const required of [
    'average_reading_time_ms',
    'decision_latency_ms',
    'retry_count',
    'attention_stability',
    'risk_appetite',
    'difficulty_escalation',
    'flow_score',
    'synthetic_feature'
  ]) {
    assert.equal(names.has(required), true, `${required} missing`);
  }
  assert.equal(features.every((item) => item.confidence >= 0 && item.confidence <= 1), true);

  const profile = new BehaviorProfileAggregator().aggregate({
    userId: 'user-1',
    features,
    windowKey: 'contest'
  });
  assert.equal(profile.confidence > 0, true);
  assert.equal(Boolean(profile.readingStyle.readingDepth), true);

  const historical = [
    ...features.map((item, index) => ({ ...item, id: crypto.randomUUID(), created_at: new Date(Date.now() + index).toISOString() })),
    ...features.map((item, index) => ({ ...item, id: crypto.randomUUID(), created_at: new Date(Date.now() + 1000 + index).toISOString(), confidence: Math.min(0.99, item.confidence + 0.01) }))
  ];
  const grouped = historical.reduce((acc, item) => {
    if (!acc[item.featureName]) acc[item.featureName] = [];
    acc[item.featureName].push(item);
    return acc;
  }, {});
  assert.equal(Object.keys(grouped).length >= 20, true);

  const largeRows = [];
  const base = Date.now();
  for (let index = 0; index < 100000; index += 1) {
    largeRows.push(telemetryEvent({
      sessionId: `large-${Math.floor(index / 1000)}`,
      sequenceNumber: index + 1,
      eventType: index % 10 === 0 ? 'PROBLEM_SWITCHED' : 'PAGE_RELOADED',
      problemId: `P${index % 6}`,
      at: new Date(base + index * 1000).toISOString()
    }));
  }
  const startedAt = Date.now();
  const largeSessions = reconstructor.reconstruct(largeRows);
  const largeLatencyMs = Date.now() - startedAt;
  assert.equal(largeSessions.length, 100);
  assert.equal(largeLatencyMs < 10000, true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    sessionsReconstructed: sessions.length,
    interruptedSessionStatus: interrupted.status,
    contestProblems: contest.problemSequence.length,
    featuresExtracted: features.length,
    confidenceValid: true,
    profileConfidence: profile.confidence,
    historicalFeatureGroups: Object.keys(grouped).length,
    largeEvents: largeRows.length,
    largeSessions: largeSessions.length,
    largeLatencyMs,
    pluginRegistration: names.has('synthetic_feature')
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
