const pool = require('../database/pool');

async function insertContext(userId, context, db = pool) {
  const result = await db.query(
    `INSERT INTO reasoning_contexts
       (user_id, context_id, evidence_package_id, plan_id, question_hash,
        context_version, ontology_version, primary_findings, secondary_findings,
        causal_chains, contradictions, missing_evidence, confidence,
        token_budget, reasoning_metadata, context_payload)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $13,
             $14, $15, $16)
     RETURNING *`,
    [
      userId,
      context.contextId,
      context.evidencePackageId || null,
      context.planId || null,
      context.questionHash || null,
      context.contextVersion,
      context.ontologyVersion,
      JSON.stringify(context.primaryFindings),
      JSON.stringify(context.secondaryFindings),
      JSON.stringify(context.causalChains),
      JSON.stringify(context.contradictions),
      JSON.stringify(context.missingEvidence),
      context.confidence,
      JSON.stringify(context.tokenBudget),
      JSON.stringify(context.reasoningMetadata),
      JSON.stringify(context)
    ]
  );
  return result.rows[0];
}

async function insertPromptPackage(userId, promptPackage, db = pool) {
  const result = await db.query(
    `INSERT INTO prompt_packages
       (user_id, prompt_package_id, reasoning_context_id, prompt_package_version,
        provider_independent, system_prompt, developer_instructions, evidence_block,
        output_schema, grounding_rules, citation_rules, safety_rules,
        response_constraints, audit, prompt_payload)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11, $12,
             $13, $14, $15)
     RETURNING *`,
    [
      userId,
      promptPackage.promptPackageId,
      promptPackage.reasoningContextId,
      promptPackage.promptPackageVersion,
      promptPackage.providerIndependent,
      promptPackage.systemPrompt,
      JSON.stringify(promptPackage.developerInstructions),
      JSON.stringify(promptPackage.evidenceBlock),
      JSON.stringify(promptPackage.outputSchema),
      JSON.stringify(promptPackage.groundingRules),
      JSON.stringify(promptPackage.citationRules),
      JSON.stringify(promptPackage.safetyRules),
      JSON.stringify(promptPackage.responseConstraints),
      JSON.stringify(promptPackage.audit),
      JSON.stringify(promptPackage)
    ]
  );
  return result.rows[0];
}

async function insertReasoningMetrics(userId, context, promptPackage = null, status = 'completed', errorMessage = null, db = pool) {
  const ontologyUsage = (context.primaryFindings || []).concat(context.secondaryFindings || []).reduce((acc, finding) => {
    acc[finding.conceptId] = (acc[finding.conceptId] || 0) + 1;
    return acc;
  }, {});
  const result = await db.query(
    `INSERT INTO reasoning_metrics
       (user_id, context_id, reasoning_latency_ms, average_findings,
        evidence_count, ontology_usage, budget_reductions, context_size_tokens,
        prompt_size_tokens, confidence, status, error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11, $12)
     RETURNING *`,
    [
      userId,
      context.contextId || null,
      context.reasoningMetadata ? context.reasoningMetadata.latencyMs || 0 : 0,
      ((context.primaryFindings || []).length + (context.secondaryFindings || []).length),
      context.evidenceSummary ? context.evidenceSummary.usedEvidence.length : 0,
      JSON.stringify(ontologyUsage),
      context.budgetDecisions ? context.budgetDecisions.length : 0,
      context.tokenBudget ? context.tokenBudget.estimatedContextTokens || 0 : 0,
      promptPackage && promptPackage.audit ? promptPackage.audit.promptSizeTokens : 0,
      context.confidence || 0,
      status,
      errorMessage
    ]
  );
  return result.rows[0];
}

async function insertCompressionMetrics(userId, context, db = pool) {
  const stats = context.reasoningMetadata.compressionStatistics || {};
  const result = await db.query(
    `INSERT INTO compression_metrics
       (user_id, context_id, original_evidence_count, used_evidence_count,
        discarded_evidence_count, compression_ratio)
     VALUES ($1, $2, $3, $4,
             $5, $6)
     RETURNING *`,
    [
      userId,
      context.contextId,
      stats.originalEvidenceCount || 0,
      stats.usedEvidenceCount || 0,
      stats.discardedEvidenceCount || 0,
      stats.compressionRatio || 1
    ]
  );
  return result.rows[0];
}

async function getContext(userId, contextId, db = pool) {
  const result = await db.query('SELECT * FROM reasoning_contexts WHERE user_id = $1 AND context_id = $2', [userId, contextId]);
  return result.rows[0] || null;
}

async function getPrompt(userId, promptId, db = pool) {
  const result = await db.query('SELECT * FROM prompt_packages WHERE user_id = $1 AND prompt_package_id = $2', [userId, promptId]);
  return result.rows[0] || null;
}

async function getMetrics(userId, limit = 50, db = pool) {
  const result = await db.query(
    `SELECT * FROM reasoning_metrics
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.max(1, Math.min(200, Number(limit) || 50))]
  );
  return result.rows;
}

module.exports = {
  insertContext,
  insertPromptPackage,
  insertReasoningMetrics,
  insertCompressionMetrics,
  getContext,
  getPrompt,
  getMetrics
};

