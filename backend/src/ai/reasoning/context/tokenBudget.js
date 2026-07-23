const TOKEN_BUDGETS = Object.freeze({
  '4k': 4096,
  '8k': 8192,
  '16k': 16384,
  '32k': 32768,
  '128k': 131072,
  unlimited: Number.MAX_SAFE_INTEGER
});

function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value || '').length / 4);
}

function resolveBudget(budget = '8k') {
  return TOKEN_BUDGETS[budget] || TOKEN_BUDGETS['8k'];
}

function applyBudget(context, budget = '8k') {
  const maximumTokens = resolveBudget(budget);
  const completionReserve = budget === '4k' ? 900 : Math.min(4096, Math.floor(maximumTokens * 0.25));
  const availableContextTokens = maximumTokens - completionReserve;
  const trimmed = { ...context, budgetDecisions: [] };

  while (estimateTokens(trimmed) > availableContextTokens && trimmed.evidenceSummary.usedEvidence.length > 0) {
    const removed = trimmed.evidenceSummary.usedEvidence.pop();
    trimmed.evidenceSummary.discardedEvidenceIds.push(removed.evidenceId);
    trimmed.budgetDecisions.push({
      action: 'discard_lowest_priority_evidence',
      evidenceId: removed.evidenceId,
      reason: 'context_budget_exceeded'
    });
  }
  while (estimateTokens(trimmed) > availableContextTokens && trimmed.secondaryFindings.length > 0) {
    const removed = trimmed.secondaryFindings.pop();
    trimmed.budgetDecisions.push({
      action: 'discard_lowest_priority_secondary_finding',
      findingId: removed.findingId,
      reason: 'context_budget_exceeded'
    });
  }
  while (estimateTokens(trimmed) > availableContextTokens && trimmed.evidenceSummary.clusters.length > 0) {
    const removed = trimmed.evidenceSummary.clusters.pop();
    trimmed.budgetDecisions.push({
      action: 'discard_lowest_priority_evidence_cluster',
      clusterId: removed.clusterId,
      reason: 'context_budget_exceeded'
    });
  }
  if (estimateTokens(trimmed) > availableContextTokens && trimmed.ontology && Array.isArray(trimmed.ontology.concepts)) {
    trimmed.ontology = {
      version: trimmed.ontology.version,
      concepts: trimmed.ontology.concepts.map((concept) => ({ id: concept.id, category: concept.category }))
    };
    trimmed.budgetDecisions.push({
      action: 'compress_ontology_labels',
      reason: 'context_budget_exceeded'
    });
  }
  if (estimateTokens(trimmed) > availableContextTokens) {
    const compressIds = (item) => {
      if (!Array.isArray(item.evidenceIds) || item.evidenceIds.length <= 10) return item;
      return {
        ...item,
        evidenceIdCount: item.evidenceIds.length,
        evidenceIds: item.evidenceIds.slice(0, 10)
      };
    };
    trimmed.primaryFindings = trimmed.primaryFindings.map(compressIds);
    trimmed.secondaryFindings = trimmed.secondaryFindings.map(compressIds);
    trimmed.causalChains = trimmed.causalChains.map((chain) => compressIds(chain));
    trimmed.findingClasses = Object.fromEntries(Object.entries(trimmed.findingClasses).map(([key, rows]) => [key, rows.map(compressIds)]));
    trimmed.budgetDecisions.push({
      action: 'compress_evidence_identifier_lists',
      reason: 'context_budget_exceeded'
    });
  }
  if (estimateTokens(trimmed) > availableContextTokens && Array.isArray(trimmed.contradictions)) {
    trimmed.contradictions = trimmed.contradictions.slice(0, 10);
    trimmed.budgetDecisions.push({
      action: 'limit_contradiction_records',
      reason: 'context_budget_exceeded'
    });
  }
  if (estimateTokens(trimmed) > availableContextTokens && trimmed.evidenceSummary.discardedEvidenceIds.length > 10) {
    trimmed.evidenceSummary.discardedEvidenceIdCount = trimmed.evidenceSummary.discardedEvidenceIds.length;
    trimmed.evidenceSummary.discardedEvidenceIds = trimmed.evidenceSummary.discardedEvidenceIds.slice(0, 10);
    trimmed.budgetDecisions.push({
      action: 'compress_discarded_evidence_identifiers',
      reason: 'context_budget_exceeded'
    });
  }
  if (estimateTokens(trimmed) > availableContextTokens && trimmed.budgetDecisions.length > 12) {
    const totalBudgetDecisions = trimmed.budgetDecisions.length;
    trimmed.budgetDecisions = [
      ...trimmed.budgetDecisions.slice(0, 6),
      ...trimmed.budgetDecisions.slice(-6)
    ];
    trimmed.budgetDecisionCount = totalBudgetDecisions;
  }

  return Object.freeze({
    ...trimmed,
    tokenBudget: {
      requestedBudget: budget,
      maximumTokens,
      estimatedContextTokens: estimateTokens(trimmed),
      availableContextTokens,
      reservedCompletionTokens: completionReserve,
      budgetExceeded: estimateTokens(trimmed) > availableContextTokens
    }
  });
}

module.exports = { TOKEN_BUDGETS, estimateTokens, applyBudget };
