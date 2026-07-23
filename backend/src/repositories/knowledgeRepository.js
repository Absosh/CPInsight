const pool = require('../database/pool');

async function getBehaviorFeatures(userId, { windowKey = null, limit = 1000 } = {}, db = pool) {
  const values = [userId];
  const clauses = ['user_id = $1'];
  if (windowKey) {
    values.push(windowKey);
    clauses.push(`window_key = $${values.length}`);
  }
  values.push(Math.max(1, Math.min(10000, Number(limit) || 1000)));
  const result = await db.query(
    `SELECT *
     FROM behavior_features
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

async function insertNode(node, db = pool) {
  const result = await db.query(
    `INSERT INTO knowledge_nodes
       (user_id, node_type, node_key, label, properties, version)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, node_type, node_key, version) DO UPDATE SET
       properties = knowledge_nodes.properties || EXCLUDED.properties
     RETURNING *`,
    [node.userId, node.nodeType, node.nodeKey, node.label, JSON.stringify(node.properties || {}), node.version]
  );
  return result.rows[0];
}

async function insertEdge(edge, sourceNodeId, targetNodeId, db = pool) {
  const result = await db.query(
    `INSERT INTO knowledge_edges
       (user_id, source_node_id, target_node_id, relationship_type,
        confidence, evidence, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      edge.userId,
      sourceNodeId,
      targetNodeId,
      edge.relationshipType,
      edge.confidence,
      JSON.stringify(edge.evidence || {}),
      edge.version
    ]
  );
  return result.rows[0];
}

async function insertInsight(userId, insight, windowKey, db = pool) {
  const result = await db.query(
    `INSERT INTO behavior_insights
       (user_id, insight_type, insight_key, category, confidence,
        supporting_features, evidence_sessions, time_window, version, properties)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      insight.insightType,
      insight.insightKey,
      insight.category,
      insight.confidence,
      insight.supportingFeatures,
      insight.evidenceSessions,
      windowKey,
      1,
      JSON.stringify({ ...insight.properties, ruleId: insight.ruleId })
    ]
  );
  return result.rows[0];
}

async function insertEvidence(insightId, insight, db = pool) {
  const rows = [];
  for (const featureId of insight.supportingFeatures) {
    const result = await db.query(
      `INSERT INTO insight_evidence
         (insight_id, feature_id, behavior_session_id, evidence_type, weight, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        insightId,
        featureId,
        insight.evidenceSessions[0] || null,
        'supporting_feature',
        insight.confidence,
        JSON.stringify({ insightKey: insight.insightKey })
      ]
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function insertPattern(pattern, db = pool) {
  const result = await db.query(
    `INSERT INTO behavior_patterns
       (user_id, pattern_key, pattern_type, confidence, recurrence_count,
        first_seen_at, last_seen_at, trend, supporting_insights, evidence, version)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      pattern.userId,
      pattern.patternKey,
      pattern.patternType,
      pattern.confidence,
      pattern.recurrenceCount,
      pattern.firstSeenAt,
      pattern.lastSeenAt,
      pattern.trend,
      pattern.supportingInsights,
      JSON.stringify(pattern.evidence || {}),
      pattern.version
    ]
  );
  return result.rows[0];
}

async function insertMetrics(record, db = pool) {
  const result = await db.query(
    `INSERT INTO insight_inference_metrics
       (user_id, run_id, insights_generated, rules_fired, inference_latency_ms,
        confidence_distribution, graph_nodes, graph_edges, pattern_count,
        status, error_message)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11)
     RETURNING *`,
    [
      record.userId || null,
      record.runId,
      record.insightsGenerated || 0,
      record.rulesFired || 0,
      record.inferenceLatencyMs || 0,
      JSON.stringify(record.confidenceDistribution || {}),
      record.graphNodes || 0,
      record.graphEdges || 0,
      record.patternCount || 0,
      record.status,
      record.errorMessage || null
    ]
  );
  return result.rows[0];
}

async function getGraph(userId, db = pool) {
  const [nodes, edges] = await Promise.all([
    db.query('SELECT * FROM knowledge_nodes WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    db.query('SELECT * FROM knowledge_edges WHERE user_id = $1 ORDER BY created_at DESC', [userId])
  ]);
  return { nodes: nodes.rows, edges: edges.rows };
}

async function getInsights(userId, category, db = pool) {
  const result = await db.query(
    `SELECT * FROM behavior_insights
     WHERE user_id = $1 AND ($2::text IS NULL OR category = $2)
     ORDER BY created_at DESC`,
    [userId, category || null]
  );
  return result.rows;
}

async function getPatterns(userId, db = pool) {
  const result = await db.query(
    'SELECT * FROM behavior_patterns WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

async function getEvidence(userId, insightId, db = pool) {
  const result = await db.query(
    `SELECT e.*
     FROM insight_evidence e
     JOIN behavior_insights i ON i.id = e.insight_id
     WHERE i.user_id = $1 AND i.id = $2
     ORDER BY e.created_at DESC`,
    [userId, insightId]
  );
  return result.rows;
}

module.exports = {
  getBehaviorFeatures,
  insertNode,
  insertEdge,
  insertInsight,
  insertEvidence,
  insertPattern,
  insertMetrics,
  getGraph,
  getInsights,
  getPatterns,
  getEvidence
};
