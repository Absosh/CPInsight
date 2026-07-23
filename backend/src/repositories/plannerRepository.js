const pool = require('../database/pool');

async function insertClassification(userId, classification, db = pool) {
  const result = await db.query(
    `INSERT INTO intent_classifications
       (user_id, question_hash, primary_intent, secondary_intents,
        confidence, ambiguous, classified_intents)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      classification.questionHash,
      classification.primaryIntent,
      classification.secondaryIntents,
      classification.confidence,
      classification.ambiguous,
      JSON.stringify(classification.intents)
    ]
  );
  return result.rows[0];
}

async function insertPlan(userId, plan, db = pool) {
  const result = await db.query(
    `INSERT INTO retrieval_plans
       (user_id, plan_id, question_hash, primary_intent, secondary_intents,
        selected_sources, selected_strategies, required_evidence, confidence_plan,
        token_budget, estimated_context_tokens, estimated_latency_ms,
        estimated_cost, execution_priority)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12,
             $13, $14)
     RETURNING *`,
    [
      userId,
      plan.planId,
      plan.questionHash,
      plan.intents.primary,
      plan.intents.secondary,
      JSON.stringify(plan.retrievalSources),
      JSON.stringify(plan.retrievalStrategies),
      JSON.stringify(plan.requiredEvidence),
      JSON.stringify(plan.confidencePlan),
      JSON.stringify(plan.tokenBudget),
      plan.tokenBudget.estimatedContextTokens,
      plan.estimates.estimatedLatencyMs,
      plan.estimates.estimatedCost,
      JSON.stringify(plan.executionPriority)
    ]
  );
  return result.rows[0];
}

async function insertMetrics(record, db = pool) {
  const result = await db.query(
    `INSERT INTO planner_metrics
       (user_id, question_hash, planner_latency_ms, primary_intent,
        intent_distribution, selected_source_count, source_selection_frequency,
        average_retrieval_cost_estimate, average_confidence_estimate,
        planning_failure, unknown_intent, error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7,
             $8, $9,
             $10, $11, $12)
     RETURNING *`,
    [
      record.userId || null,
      record.questionHash || null,
      record.plannerLatencyMs || 0,
      record.primaryIntent || null,
      JSON.stringify(record.intentDistribution || {}),
      record.selectedSourceCount || 0,
      JSON.stringify(record.sourceSelectionFrequency || {}),
      record.averageRetrievalCostEstimate || 0,
      record.averageConfidenceEstimate || 0,
      Boolean(record.planningFailure),
      Boolean(record.unknownIntent),
      record.errorMessage || null
    ]
  );
  return result.rows[0];
}

module.exports = { insertClassification, insertPlan, insertMetrics };

