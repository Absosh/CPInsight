const pool = require('../database/pool');

async function insertRuntimeResult(userId, result, status = 'completed', errorMessage = null, db = pool) {
  const request = await db.query(
    `INSERT INTO llm_requests
       (user_id, runtime_request_id, execution_plan_id, prompt_package_id,
        provider_name, model_name, request_mode, status, latency_ms,
        retries, fallbacks, cancelled, request_metadata, response_metadata,
        error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8, $9,
             $10, $11, $12, $13, $14,
             $15)
     RETURNING *`,
    [
      userId,
      result.runtimeRequestId,
      result.executionPlanId || null,
      result.promptPackageId || null,
      result.provider || 'unknown',
      result.model || 'unknown',
      result.streaming ? 'streaming' : 'non_streaming',
      status,
      result.latencyMs || 0,
      result.retries || 0,
      result.fallbacks || 0,
      Boolean(result.cancelled),
      JSON.stringify({ attempts: result.attempts || [], modelSelectionReason: result.modelSelectionReason }),
      JSON.stringify({ rawResponseStored: false, textStored: false }),
      errorMessage
    ]
  );
  const tokens = result.tokenAccounting || {};
  const cost = result.costAccounting || {};
  await db.query(
    `INSERT INTO llm_usage
       (user_id, runtime_request_id, provider_name, model_name, prompt_tokens,
        completion_tokens, cached_tokens, estimated_tokens, total_tokens,
        budget_usage, estimated_cost, actual_cost)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12)`,
    [
      userId,
      result.runtimeRequestId,
      result.provider || 'unknown',
      result.model || 'unknown',
      tokens.promptTokens || 0,
      tokens.completionTokens || 0,
      tokens.cachedTokens || 0,
      tokens.estimatedPromptTokens || 0,
      tokens.totalTokens || 0,
      tokens.budgetUsage || 0,
      cost.estimatedCost || 0,
      cost.actualCost || 0
    ]
  );
  await db.query(
    `INSERT INTO runtime_metrics
       (user_id, runtime_request_id, request_latency_ms, streaming_latency_ms,
        retry_count, fallback_count, token_usage, cost_usage,
        cancellation_count, queue_length, status, error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11, $12)`,
    [
      userId,
      result.runtimeRequestId,
      result.latencyMs || 0,
      result.streaming ? result.latencyMs || 0 : 0,
      result.retries || 0,
      result.fallbacks || 0,
      JSON.stringify(tokens),
      JSON.stringify(cost),
      result.cancelled ? 1 : 0,
      0,
      status,
      errorMessage
    ]
  );
  return request.rows[0];
}

async function getMetrics(userId, limit = 50, db = pool) {
  const result = await db.query(
    `SELECT * FROM runtime_metrics
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.max(1, Math.min(200, Number(limit) || 50))]
  );
  return result.rows;
}

module.exports = { insertRuntimeResult, getMetrics };

