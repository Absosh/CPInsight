const { SourceAdapter } = require('./sourceAdapter');

function rowEvidence({ source, type, row, confidence = 0.7, timestamp = null, version = 1, distance = 1 }) {
  const id = row.id || row.event_id || `${source}:${JSON.stringify(row).slice(0, 80)}`;
  return {
    evidenceId: `${source}:${id}`,
    source,
    type,
    identifier: String(id),
    confidence: Number(Math.max(0, Math.min(1, Number(confidence || 0))).toFixed(4)),
    timestamp: timestamp || row.created_at || row.started_at || row.event_timestamp || new Date(0).toISOString(),
    version: Number(row.version || row.feature_version || row.profile_version || version || 1),
    distance,
    payload: row,
    references: { sourceTable: type }
  };
}

class BehaviorProfilesAdapter extends SourceAdapter {
  constructor({ behaviorRepository }) {
    super({ name: 'behavior_profiles', reliability: 0.86 });
    this.behaviorRepository = behaviorRepository;
  }

  async retrieve({ userId, source }) {
    const profile = await this.behaviorRepository.getLatestProfile(userId, 'all');
    return profile ? [rowEvidence({ source: this.name, type: 'behavior_profiles', row: profile, confidence: profile.confidence, distance: source.priority })] : [];
  }
}

class BehaviorFeaturesAdapter extends SourceAdapter {
  constructor({ behaviorRepository }) {
    super({ name: 'behavior_features', reliability: 0.82 });
    this.behaviorRepository = behaviorRepository;
  }

  async retrieve({ userId, source }) {
    const rows = await this.behaviorRepository.getFeatures(userId, { limit: source.limit || 100 });
    return rows.map((row) => rowEvidence({ source: this.name, type: 'behavior_features', row, confidence: row.confidence, distance: source.priority }));
  }
}

class KnowledgeGraphAdapter extends SourceAdapter {
  constructor({ knowledgeRepository }) {
    super({ name: 'behavior_knowledge_graph', reliability: 0.9 });
    this.knowledgeRepository = knowledgeRepository;
  }

  async retrieve({ userId, source, options = {} }) {
    const graph = await this.knowledgeRepository.getGraph(userId);
    const minConfidence = options.minConfidence || source.requiredConfidence || 0;
    const maxDepth = Math.max(1, Math.min(3, Number(options.maxDepth) || 2));
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const visited = new Set();
    const evidence = [];
    for (const edge of graph.edges) {
      if (Number(edge.confidence) < minConfidence) continue;
      if (visited.has(edge.id)) continue;
      visited.add(edge.id);
      const target = nodeById.get(edge.target_node_id);
      evidence.push(rowEvidence({
        source: this.name,
        type: 'knowledge_edges',
        row: { ...edge, target },
        confidence: edge.confidence,
        version: edge.version,
        distance: Math.min(maxDepth, source.priority || 1)
      }));
    }
    return evidence.slice(0, source.limit || 50);
  }
}

class BehaviorInsightsAdapter extends SourceAdapter {
  constructor({ knowledgeRepository }) {
    super({ name: 'behavior_insights', reliability: 0.88 });
    this.knowledgeRepository = knowledgeRepository;
  }

  async retrieve({ userId, source }) {
    const rows = await this.knowledgeRepository.getInsights(userId, null);
    return rows.slice(0, source.limit || 30).map((row) => rowEvidence({ source: this.name, type: 'behavior_insights', row, confidence: row.confidence, distance: source.priority }));
  }
}

class EvidenceStoreAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'evidence_store', reliability: 0.9 });
    this.db = db;
  }

  async retrieve({ userId, source }) {
    const result = await this.db.query(
      `SELECT e.*, i.insight_key, i.category, i.confidence AS insight_confidence
       FROM insight_evidence e
       JOIN behavior_insights i ON i.id = e.insight_id
       WHERE i.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(200, Number(source.limit) || 80))]
    );
    return result.rows.map((row) => rowEvidence({ source: this.name, type: 'insight_evidence', row, confidence: row.weight || row.insight_confidence, distance: source.priority }));
  }
}

class ContestHistoryAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'contest_history', reliability: 0.78 });
    this.db = db;
  }

  async retrieve({ userId, source }) {
    const result = await this.db.query(
      `SELECT ch.*
       FROM contest_history ch
       JOIN platform_accounts pa ON pa.id = ch.platform_account_id
       WHERE pa.user_id = $1
       ORDER BY ch.participated_at DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(100, Number(source.limit) || 20))]
    );
    return result.rows.map((row) => rowEvidence({ source: this.name, type: 'contest_history', row, confidence: 0.72, timestamp: row.participated_at, distance: source.priority }));
  }
}

class ContestSummariesAdapter extends ContestHistoryAdapter {
  constructor({ db }) {
    super({ db });
    this.name = 'contest_summaries';
    this.reliability = 0.76;
  }
}

class SessionSummariesAdapter extends SourceAdapter {
  constructor({ behaviorRepository }) {
    super({ name: 'session_summaries', reliability: 0.82 });
    this.behaviorRepository = behaviorRepository;
  }

  async retrieve({ userId, source }) {
    const rows = await this.behaviorRepository.getSessions(userId, source.limit || 20);
    return rows.map((row) => rowEvidence({ source: this.name, type: 'behavior_sessions', row, confidence: 0.74, timestamp: row.started_at, distance: source.priority }));
  }
}

class HistoricalAggregationsAdapter extends SourceAdapter {
  constructor({ behaviorRepository }) {
    super({ name: 'historical_aggregations', reliability: 0.8 });
    this.behaviorRepository = behaviorRepository;
  }

  async retrieve({ userId, source }) {
    const rows = await this.behaviorRepository.getFeatures(userId, { limit: source.limit || 50 });
    const byName = rows.reduce((acc, row) => {
      acc[row.feature_name] = acc[row.feature_name] || [];
      acc[row.feature_name].push(Number(row.value && row.value.value !== undefined ? row.value.value : row.value));
      return acc;
    }, {});
    return Object.entries(byName).map(([featureName, values]) => rowEvidence({
      source: this.name,
      type: 'historical_aggregations',
      row: { id: featureName, featureName, count: values.length, average: values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / values.length },
      confidence: 0.7,
      distance: source.priority
    }));
  }
}

function requestedPlatform(plan) {
  const question = String(plan?.question || '').toLowerCase();
  if (question.includes('codeforces')) return 'codeforces';
  if (question.includes('leetcode')) return 'leetcode';
  if (question.includes('codechef')) return 'codechef';
  return null;
}

function targetRatingRange(plan) {
  const question = String(plan?.question || '');
  const numbers = question.match(/\b\d{3,4}\b/g)?.map(Number) || [];
  if (numbers.length < 2) return null;
  const [min, max] = numbers.slice(0, 2).sort((a, b) => a - b);
  return { min, max };
}

function topicPriorityScore(row, plan) {
  const range = targetRatingRange(plan);
  const topic = String(row.topic || '').toLowerCase();
  const attempts = Number(row.submissions || 0);
  const solved = Number(row.solved_problems || 0);
  const acceptanceRate = Number(row.acceptance_rate || 0);
  const averageDifficulty = Number(row.average_difficulty || 0);
  const bandFit = range && averageDifficulty
    ? Math.max(0, 1 - (Math.min(Math.abs(averageDifficulty - range.min), Math.abs(averageDifficulty - range.max)) / 400))
    : 0.4;
  const sample = Math.min(1, attempts / 8);
  const weakness = Math.max(0, 1 - acceptanceRate);
  const underPracticed = Math.max(0, 1 - solved / 8);
  const fundamental = ['dp', 'binary search', 'greedy', 'graphs', 'dfs and similar', 'two pointers', 'data structures'].includes(topic) ? 0.18 : 0;
  return Number((bandFit * 0.35 + sample * 0.2 + weakness * 0.18 + underPracticed * 0.09 + fundamental).toFixed(4));
}

class TopicPerformanceAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'topic_performance', reliability: 0.75 });
    this.db = db;
  }

  async retrieve({ userId, plan, source }) {
    const platform = requestedPlatform(plan);
    const result = await this.db.query(
      `WITH expanded AS (
         SELECT
           LOWER(tag) AS topic,
           sh.platform,
           sh.problem_key,
           sh.problem_name,
           sh.verdict,
           sh.difficulty,
           sh.submitted_at,
           CASE
             WHEN (sh.platform = 'codeforces' AND sh.verdict = 'OK')
               OR (sh.platform = 'leetcode' AND sh.verdict = 'AC')
               OR sh.verdict IN ('ACCEPTED', 'Accepted')
             THEN 1 ELSE 0
           END AS accepted
         FROM submission_history sh
         JOIN platform_accounts pa ON pa.id = sh.platform_account_id
         CROSS JOIN LATERAL unnest(sh.tags) AS tag
         WHERE pa.user_id = $1
           AND sh.tags IS NOT NULL
           AND ($3::text IS NULL OR sh.platform::text = $3)
       )
       SELECT
         topic,
         COUNT(*)::int AS submissions,
         SUM(accepted)::int AS accepted_submissions,
         COUNT(DISTINCT CASE WHEN accepted = 1 THEN problem_key END)::int AS solved_problems,
         COUNT(DISTINCT problem_key)::int AS attempted_problems,
         ROUND((SUM(accepted)::numeric / NULLIF(COUNT(*), 0)), 4)::float AS acceptance_rate,
         ROUND(AVG(difficulty) FILTER (WHERE difficulty IS NOT NULL))::int AS average_difficulty,
         MAX(submitted_at) AS latest_attempt_at,
         COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '30 days')::int AS recent_submissions,
         ARRAY_AGG(DISTINCT platform::text) AS platforms
       FROM expanded
       GROUP BY topic
       ORDER BY
         solved_problems ASC,
         submissions DESC,
         recent_submissions DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(100, Number(source.limit) || 50)), platform]
    );
    return result.rows.map((row) => {
      const attempts = Number(row.submissions || 0);
      const solved = Number(row.solved_problems || 0);
      const acceptanceRate = Number(row.acceptance_rate || 0);
      const priorityScore = topicPriorityScore(row, plan);
      const confidence = Math.min(0.9, 0.52 + Math.min(0.16, attempts / 100) + Math.min(0.14, priorityScore / 4) + Math.min(0.08, Number(row.recent_submissions || 0) / 100));
      return rowEvidence({
        source: this.name,
        type: 'topic_performance',
        row: {
          id: row.topic,
          topic: row.topic,
          submissions: attempts,
          acceptedSubmissions: Number(row.accepted_submissions || 0),
          solvedProblems: solved,
          attemptedProblems: Number(row.attempted_problems || 0),
          acceptanceRate,
          averageDifficulty: row.average_difficulty,
          latestAttemptAt: row.latest_attempt_at,
          recentSubmissions: Number(row.recent_submissions || 0),
          platforms: row.platforms || [],
          requestedPlatform: platform,
          ratingGapPriorityScore: priorityScore,
          gapSignal: solved <= 2 || acceptanceRate < 0.45 ? 'candidate_weak_topic' : 'practiced_topic'
        },
        confidence,
        timestamp: row.latest_attempt_at,
        distance: source.priority
      });
    }).sort((a, b) => (b.payload.ratingGapPriorityScore || 0) - (a.payload.ratingGapPriorityScore || 0) || b.confidence - a.confidence);
  }
}

class PlatformStatisticsAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'platform_statistics', reliability: 0.74 });
    this.db = db;
  }

  async retrieve({ userId, source }) {
    const result = await this.db.query(
      `SELECT sh.platform, COUNT(*)::int AS submissions
       FROM submission_history sh
       JOIN platform_accounts pa ON pa.id = sh.platform_account_id
       WHERE pa.user_id = $1
       GROUP BY sh.platform
       ORDER BY submissions DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(50, Number(source.limit) || 20))]
    );
    return result.rows.map((row) => rowEvidence({ source: this.name, type: 'platform_statistics', row: { id: row.platform, ...row }, confidence: 0.68, distance: source.priority }));
  }
}

class UserMetadataAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'user_metadata', reliability: 0.72 });
    this.db = db;
  }

  async retrieve({ userId, source }) {
    const result = await this.db.query(
      `SELECT u.id, u.username, u.created_at, p.timezone, p.country
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );
    return result.rows.map((row) => rowEvidence({ source: this.name, type: 'user_metadata', row, confidence: 0.65, distance: source.priority }));
  }
}

class FeatureVersionsAdapter extends SourceAdapter {
  constructor({ db }) {
    super({ name: 'feature_versions', reliability: 0.8 });
    this.db = db;
  }

  async retrieve({ source }) {
    const result = await this.db.query('SELECT * FROM feature_versions ORDER BY created_at DESC LIMIT $1', [source.limit || 10]);
    return result.rows.map((row) => rowEvidence({ source: this.name, type: 'feature_versions', row, confidence: 0.76, distance: source.priority }));
  }
}

class PatternEvolutionAdapter extends SourceAdapter {
  constructor({ knowledgeRepository }) {
    super({ name: 'pattern_evolution', reliability: 0.84 });
    this.knowledgeRepository = knowledgeRepository;
  }

  async retrieve({ userId, source }) {
    const rows = await this.knowledgeRepository.getPatterns(userId);
    return rows.slice(0, source.limit || 30).map((row) => rowEvidence({ source: this.name, type: 'behavior_patterns', row, confidence: row.confidence, distance: source.priority }));
  }
}

class FutureStubAdapter extends SourceAdapter {
  constructor(name) {
    super({ name, reliability: 0 });
  }

  health() {
    return { name: this.name, healthy: true, stub: true, reliability: 0 };
  }

  async retrieve() {
    return [];
  }
}

module.exports = {
  BehaviorProfilesAdapter,
  BehaviorFeaturesAdapter,
  KnowledgeGraphAdapter,
  BehaviorInsightsAdapter,
  EvidenceStoreAdapter,
  ContestHistoryAdapter,
  ContestSummariesAdapter,
  SessionSummariesAdapter,
  HistoricalAggregationsAdapter,
  TopicPerformanceAdapter,
  PlatformStatisticsAdapter,
  UserMetadataAdapter,
  FeatureVersionsAdapter,
  PatternEvolutionAdapter,
  FutureStubAdapter
};
