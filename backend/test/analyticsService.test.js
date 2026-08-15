const { after, test } = require('node:test');
const assert = require('node:assert/strict');

const { _private } = require('../src/services/analyticsService');
const pool = require('../src/database/pool');
const { redis } = require('../src/redis/client');

after(async () => {
  redis.disconnect();
  await pool.end();
});

function submission(overrides = {}) {
  return {
    platform: 'codeforces',
    verdict: 'OK',
    problem_key: '100-A',
    tags: ['dp'],
    difficulty: 1200,
    submitted_at: '2026-08-10T12:00:00.000Z',
    ...overrides
  };
}

test('topic intelligence preserves attempts, unique solves, and weighted difficulty', () => {
  const topics = _private.buildTopicStrength([
    submission(),
    submission({ verdict: 'WRONG_ANSWER' }),
    submission({ problem_key: '101-B', difficulty: 1600, submitted_at: '2026-08-11T12:00:00.000Z' })
  ]);

  assert.equal(topics.length, 1);
  assert.deepEqual(
    {
      attempts: topics[0].attempts,
      accepted: topics[0].accepted,
      solved: topics[0].solved,
      averageDifficulty: topics[0].averageDifficulty,
      difficultySamples: topics[0].difficultySamples,
      successRate: topics[0].successRate
    },
    { attempts: 3, accepted: 2, solved: 2, averageDifficulty: 1400, difficultySamples: 2, successRate: 67 }
  );
});

test('combined topic intelligence aggregates platform facts without synthetic rows', () => {
  const combined = _private.combineTopicStrength([
    {
      topicStrength: [{
        topic: 'dp', attempts: 4, accepted: 2, solved: 2,
        averageDifficulty: 1200, difficultySamples: 2, lastSolved: 10, strength: 0
      }]
    },
    {
      topicStrength: [{
        topic: 'DP', attempts: 6, accepted: 3, solved: 3,
        averageDifficulty: 1600, difficultySamples: 3, lastSolved: 20, strength: 0
      }]
    }
  ]);

  assert.equal(combined.length, 1);
  assert.equal(combined[0].attempts, 10);
  assert.equal(combined[0].accepted, 5);
  assert.equal(combined[0].solved, 5);
  assert.equal(combined[0].averageDifficulty, 1440);
  assert.equal(combined[0].difficultySamples, 5);
  assert.equal(combined[0].successRate, 50);
  assert.equal(combined[0].lastSolved, 20);
});

test('difficulty intelligence deduplicates accepted problems', () => {
  const result = _private.buildDifficultyIntelligence([
    submission(),
    submission({ verdict: 'WRONG_ANSWER', difficulty: 1800 }),
    submission({ problem_key: '101-B', difficulty: 1600 }),
    submission({ problem_key: '101-B', difficulty: 1600 })
  ]);

  assert.equal(result.sampleSize, 2);
  assert.equal(result.averageDifficulty, 1400);
  assert.equal(result.medianDifficulty, 1600);
  assert.equal(result.highestSolved, 1600);
  assert.equal(result.histogram.values.reduce((sum, value) => sum + value, 0), 2);
});

test('activity intelligence is derived from the complete heatmap', () => {
  const result = _private.buildActivityIntelligence(
    { '2026-08-10': 1, '2026-08-11': 2, '2026-08-13': 4 },
    Date.parse('2026-08-14T12:00:00.000Z')
  );

  assert.equal(result.activeDays, 3);
  assert.equal(result.longestStreak, 2);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.submissionsLast90Days, 7);
});
