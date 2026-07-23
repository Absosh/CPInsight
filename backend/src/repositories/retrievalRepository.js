const pool = require('../database/pool');

async function insertEvidencePackage(userId, evidencePackage, db = pool) {
  const result = await db.query(
    `INSERT INTO evidence_packages
       (user_id, package_id, plan_id, question_hash, retrieval_metadata,
        retrieved_sources, evidence, ignored_evidence, contradictions,
        confidence_summary, missing_evidence, retrieval_statistics)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12)
     RETURNING *`,
    [
      userId,
      evidencePackage.packageId,
      evidencePackage.planId,
      evidencePackage.questionHash,
      JSON.stringify(evidencePackage.retrievalMetadata),
      JSON.stringify(evidencePackage.retrievedSources),
      JSON.stringify(evidencePackage.evidence),
      JSON.stringify(evidencePackage.ignoredEvidence),
      JSON.stringify(evidencePackage.contradictions),
      JSON.stringify(evidencePackage.confidenceSummary),
      JSON.stringify(evidencePackage.missingEvidence),
      JSON.stringify(evidencePackage.statistics)
    ]
  );
  return result.rows[0];
}

async function insertExecutionMetrics(userId, evidencePackage, status = 'completed', errorMessage = null, db = pool) {
  const result = await db.query(
    `INSERT INTO retrieval_execution_metrics
       (user_id, package_id, plan_id, retrieval_latency_ms, evidence_count,
        contradiction_count, missing_evidence_count, cache_hit_rate,
        source_failure_count, partial_failure, status, error_message)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11, $12)
     RETURNING *`,
    [
      userId,
      evidencePackage.packageId || null,
      evidencePackage.planId || null,
      evidencePackage.statistics ? evidencePackage.statistics.retrievalLatencyMs || 0 : 0,
      evidencePackage.evidence ? evidencePackage.evidence.length : 0,
      evidencePackage.contradictions ? evidencePackage.contradictions.length : 0,
      evidencePackage.missingEvidence ? evidencePackage.missingEvidence.length : 0,
      evidencePackage.statistics && evidencePackage.statistics.cache ? evidencePackage.statistics.cache.hitRate : 0,
      evidencePackage.statistics ? evidencePackage.statistics.sourceFailures || 0 : 0,
      evidencePackage.statistics ? Boolean(evidencePackage.statistics.partialFailure) : false,
      status,
      errorMessage
    ]
  );
  return result.rows[0];
}

async function insertSourceMetrics(userId, evidencePackage, db = pool) {
  const rows = [];
  for (const source of evidencePackage.retrievedSources || []) {
    const result = await db.query(
      `INSERT INTO retrieval_source_metrics
         (user_id, package_id, source_name, status, latency_ms,
          evidence_count, cache_hit, error_message)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8)
       RETURNING *`,
      [
        userId,
        evidencePackage.packageId,
        source.source,
        source.status,
        source.latencyMs || 0,
        source.evidenceCount || 0,
        Boolean(source.cacheHit),
        source.error || null
      ]
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function insertFusionMetrics(userId, evidencePackage, db = pool) {
  const stats = evidencePackage.statistics || {};
  const result = await db.query(
    `INSERT INTO fusion_metrics
       (user_id, package_id, fusion_latency_ms, raw_evidence_count,
        normalized_evidence_count, ranked_evidence_count,
        resolved_evidence_count, contradiction_count)
     VALUES ($1, $2, $3, $4,
             $5, $6,
             $7, $8)
     RETURNING *`,
    [
      userId,
      evidencePackage.packageId,
      stats.fusionLatencyMs || 0,
      stats.rawEvidenceCount || 0,
      stats.normalizedEvidenceCount || 0,
      stats.rankedEvidenceCount || 0,
      stats.resolvedEvidenceCount || 0,
      stats.contradictionCount || 0
    ]
  );
  return result.rows[0];
}

async function getPackage(userId, packageId, db = pool) {
  const result = await db.query(
    'SELECT * FROM evidence_packages WHERE user_id = $1 AND package_id = $2',
    [userId, packageId]
  );
  return result.rows[0] || null;
}

async function getMetrics(userId, limit = 50, db = pool) {
  const result = await db.query(
    `SELECT * FROM retrieval_execution_metrics
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.max(1, Math.min(200, Number(limit) || 50))]
  );
  return result.rows;
}

module.exports = {
  insertEvidencePackage,
  insertExecutionMetrics,
  insertSourceMetrics,
  insertFusionMetrics,
  getPackage,
  getMetrics
};

