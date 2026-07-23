const pool = require('../database/pool');

async function withTransaction(work, db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function insertValidation(userId, result, db = pool) {
  const response = await db.query(
    `INSERT INTO validated_responses
       (user_id, validation_id, execution_plan_id, reasoning_context_id,
        evidence_package_id, validated_response, validation_report, quality_report)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      result.validationId,
      result.executionPlanId || null,
      result.reasoningContextId || null,
      result.evidencePackageId || null,
      JSON.stringify(result.validatedResponse),
      JSON.stringify(result.validationReport),
      JSON.stringify(result.qualityReport)
    ]
  );
  const q = result.qualityReport;
  await db.query(
    `INSERT INTO response_quality
       (user_id, validation_id, grounding_coverage, citation_quality,
        recommendation_support, actionability, readability, completeness,
        conciseness, contradiction_count, overall_quality_score)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11)`,
    [userId, result.validationId, q.groundingCoverage, q.citationQuality, q.recommendationSupport, q.actionability, q.readability, q.completeness, q.conciseness, q.contradictionCount, q.overallQualityScore]
  );
  return response.rows[0];
}

async function insertReflections(userId, validationId, reflections, db = pool) {
  const rows = [];
  for (const reflection of reflections) {
    const inserted = await db.query(
      `INSERT INTO reflection_memory
         (user_id, reflection_id, validation_id, reflection_type, behavior_finding,
          confidence, importance, expires_at, version, payload)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, reflection.reflectionId, validationId, reflection.type, reflection.behaviorFinding, reflection.confidence, reflection.importance, reflection.expires, reflection.version, JSON.stringify(reflection)]
    );
    rows.push(inserted.rows[0]);
    for (const evidenceId of reflection.supportingEvidence || []) {
      await db.query(
        'INSERT INTO reflection_links (reflection_id, evidence_id) VALUES ($1, $2)',
        [reflection.reflectionId, evidenceId]
      );
    }
  }
  return rows;
}

async function insertValidationMetrics(userId, result, status = 'completed', errorMessage = null, db = pool) {
  const report = result.validationReport || {};
  const metrics = await db.query(
    `INSERT INTO validation_metrics
       (user_id, validation_id, validation_latency_ms, grounding_failures,
        citation_failures, confidence_mismatch, recommendation_rejections,
        reflection_count, regeneration_count, status, error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7,
             $8, $9, $10, $11)
     RETURNING *`,
    [
      userId,
      result.validationId || null,
      result.metadata ? result.metadata.validationLatencyMs || 0 : 0,
      report.grounding ? report.grounding.unsupported.length : 0,
      report.citations ? report.citations.fabricated.length : 0,
      report.confidence ? report.confidence.mismatch : 0,
      report.recommendations ? report.recommendations.rejected.length : 0,
      result.behaviorReflections ? result.behaviorReflections.length : 0,
      report.regeneration && report.regeneration.requested ? 1 : 0,
      status,
      errorMessage
    ]
  );
  return metrics.rows[0];
}

async function insertFeedback(userId, feedback, db = pool) {
  const result = await db.query(
    `INSERT INTO human_feedback
       (user_id, response_id, feedback_type, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, feedback.responseId || null, feedback.feedbackType, JSON.stringify(feedback.metadata)]
  );
  await db.query(
    'INSERT INTO feedback_metrics (feedback_type, metadata) VALUES ($1, $2)',
    [feedback.feedbackType, JSON.stringify({ responseId: feedback.responseId || null })]
  );
  return result.rows[0];
}

async function getQuality(userId, validationId, db = pool) {
  const result = await db.query('SELECT * FROM validated_responses WHERE user_id = $1 AND validation_id = $2', [userId, validationId]);
  return result.rows[0] || null;
}

async function getReflections(userId, db = pool) {
  const result = await db.query(
    'SELECT * FROM reflection_memory WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

async function getFeedbackMetrics(db = pool) {
  const result = await db.query(
    `SELECT feedback_type, COUNT(*)::int AS count
     FROM human_feedback
     GROUP BY feedback_type
     ORDER BY feedback_type`
  );
  return result.rows;
}

async function getValidationMetrics(userId, db = pool) {
  const result = await db.query(
    'SELECT * FROM validation_metrics WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return result.rows;
}

module.exports = {
  withTransaction,
  insertValidation,
  insertReflections,
  insertValidationMetrics,
  insertFeedback,
  getQuality,
  getReflections,
  getFeedbackMetrics,
  getValidationMetrics
};
