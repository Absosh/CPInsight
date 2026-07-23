const SAFETY_POLICIES = Object.freeze({
  grounding: {
    policyVersion: 1,
    rules: [
      'Never fabricate evidence.',
      'Never recommend unsupported improvements.',
      'Always expose uncertainty.',
      'Separate observations, inferences, and recommendations.',
      'Cite evidence identifiers for every behavioral claim.'
    ]
  },
  coaching: {
    policyVersion: 1,
    rules: [
      'Keep actions evidence-supported.',
      'Avoid medical, legal, or mental-health claims.',
      'Do not overstate confidence.'
    ]
  },
  prediction: {
    policyVersion: 1,
    rules: [
      'Frame predictions as uncertainty-bounded estimates.',
      'Do not guarantee contest outcomes.',
      'Use historical evidence and confidence thresholds.'
    ]
  }
});

const EVALUATION_POLICIES = Object.freeze({
  diagnostic: {
    policyVersion: 1,
    checks: ['evidence_coverage', 'reasoning_completeness', 'confidence_threshold', 'historical_consistency']
  },
  coaching: {
    policyVersion: 1,
    checks: ['actionability', 'evidence_support', 'personalization', 'uncertainty_exposure']
  },
  planning: {
    policyVersion: 1,
    checks: ['milestone_quality', 'goal_alignment', 'feasibility', 'evidence_support']
  },
  explanation: {
    policyVersion: 1,
    checks: ['citation_completeness', 'claim_support', 'uncertainty_exposure']
  },
  general: {
    policyVersion: 1,
    checks: ['grounding', 'schema_compliance', 'safety_policy_compliance']
  }
});

class PolicyEngine {
  safetyPolicies(task) {
    const policies = [SAFETY_POLICIES.grounding];
    if (task.policyGroup === 'coaching') policies.push(SAFETY_POLICIES.coaching);
    if (task.policyGroup === 'prediction') policies.push(SAFETY_POLICIES.prediction);
    return policies;
  }

  evaluationRules(task) {
    return EVALUATION_POLICIES[task.evaluationGroup] || EVALUATION_POLICIES.general;
  }

  all() {
    return { safetyPolicies: SAFETY_POLICIES, evaluationPolicies: EVALUATION_POLICIES };
  }
}

module.exports = { PolicyEngine, SAFETY_POLICIES, EVALUATION_POLICIES };

