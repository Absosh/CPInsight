const pool = require('../database/pool');

async function insertExecutionPlan(userId, plan, db = pool) {
  const result = await db.query(
    `INSERT INTO execution_plans
       (user_id, execution_plan_id, execution_plan_version, question_hash,
        reasoning_context_id, prompt_package_id, primary_task, task_chain,
        reasoning_modes, prompt_strategies, output_schemas, evaluation_rules,
        safety_constraints, execution_metadata, plan_payload)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11, $12,
             $13, $14, $15)
     RETURNING *`,
    [
      userId,
      plan.executionPlanId,
      plan.executionPlanVersion,
      plan.questionHash,
      plan.reasoningContextId,
      plan.promptPackageId,
      plan.routing.primaryTask,
      JSON.stringify(plan.routing.taskChain),
      JSON.stringify(plan.reasoningModes),
      JSON.stringify(plan.promptStrategies),
      JSON.stringify(plan.outputSchemas),
      JSON.stringify(plan.evaluationRules),
      JSON.stringify(plan.safetyConstraints),
      JSON.stringify(plan.executionMetadata),
      JSON.stringify(plan)
    ]
  );
  return result.rows[0];
}

async function insertExecutionMetrics(userId, plan, status = 'completed', errorMessage = null, db = pool) {
  const strategyDistribution = plan.promptStrategies ? plan.promptStrategies.reduce((acc, strategy) => {
    acc[strategy.strategyId] = (acc[strategy.strategyId] || 0) + 1;
    return acc;
  }, {}) : {};
  const reasoningModeUsage = plan.reasoningModes ? plan.reasoningModes.reduce((acc, mode) => {
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {}) : {};
  const result = await db.query(
    `INSERT INTO execution_metrics
       (user_id, execution_plan_id, primary_task, strategy_distribution,
        reasoning_mode_usage, task_routing_latency_ms, execution_plan_latency_ms,
        unknown_task, policy_violation_count, average_complexity, status,
        error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7,
             $8, $9, $10, $11,
             $12)
     RETURNING *`,
    [
      userId,
      plan.executionPlanId || null,
      plan.routing ? plan.routing.primaryTask : null,
      JSON.stringify(strategyDistribution),
      JSON.stringify(reasoningModeUsage),
      plan.executionMetadata ? plan.executionMetadata.latencyMs || 0 : 0,
      plan.executionMetadata ? plan.executionMetadata.latencyMs || 0 : 0,
      plan.routing ? plan.routing.primaryTask === 'unknown' : false,
      0,
      plan.executionMetadata ? plan.executionMetadata.complexity || 0 : 0,
      status,
      errorMessage
    ]
  );
  return result.rows[0];
}

async function getExecutionPlan(userId, executionPlanId, db = pool) {
  const result = await db.query(
    'SELECT * FROM execution_plans WHERE user_id = $1 AND execution_plan_id = $2',
    [userId, executionPlanId]
  );
  return result.rows[0] || null;
}

module.exports = { insertExecutionPlan, insertExecutionMetrics, getExecutionPlan };

