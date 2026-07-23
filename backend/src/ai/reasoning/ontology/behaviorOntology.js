const ONTOLOGY_VERSION = 1;

const CONCEPTS = Object.freeze({
  DEEP_READING: { id: 'deep_reading', category: 'cognitive_behavior', labels: ['reading', 'deep_reading', 'average_reading_time_ms'] },
  FAST_RECOGNITION: { id: 'fast_recognition', category: 'cognitive_behavior', labels: ['fast_recognition', 'problem_scanning_speed'] },
  DECISION_DELAY: { id: 'decision_delay', category: 'cognitive_behavior', labels: ['decision_latency', 'time_before_first_attempt'] },
  HESITATION: { id: 'hesitation', category: 'cognitive_behavior', labels: ['hesitation_score', 'hesitation'] },
  PROBLEM_DECOMPOSITION: { id: 'problem_decomposition', category: 'cognitive_behavior', labels: ['problem_decomposition'] },
  PATTERN_RECOGNITION: { id: 'pattern_recognition', category: 'cognitive_behavior', labels: ['pattern_recognition', 'recognition'] },
  RISK_TAKING: { id: 'risk_taking', category: 'contest_strategy', labels: ['risk_appetite', 'risk_management_weakness'] },
  DIFFICULTY_ESCALATION: { id: 'difficulty_escalation', category: 'contest_strategy', labels: ['difficulty_escalation'] },
  DIFFICULTY_AVOIDANCE: { id: 'difficulty_avoidance', category: 'contest_strategy', labels: ['difficulty_avoidance'] },
  TIME_ALLOCATION: { id: 'time_allocation', category: 'contest_strategy', labels: ['time_allocation', 'time_management', 'late_contest_panic'] },
  RECOVERY_STRATEGY: { id: 'recovery_strategy', category: 'contest_strategy', labels: ['recovery_rate', 'strong_recovery_ability', 'recovery'] },
  SUBMISSION_STRATEGY: { id: 'submission_strategy', category: 'contest_strategy', labels: ['submission_cadence', 'retry_count'] },
  RAPID_IMPROVEMENT: { id: 'rapid_improvement', category: 'learning_behavior', labels: ['rapid_improvement', 'momentum_score'] },
  PLATEAU: { id: 'plateau', category: 'learning_behavior', labels: ['plateau'] },
  REGRESSION: { id: 'regression', category: 'learning_behavior', labels: ['regression'] },
  CONSISTENCY: { id: 'consistency', category: 'learning_behavior', labels: ['consistency', 'reading_consistency', 'attention_stability'] },
  TOPIC_MASTERY: { id: 'topic_mastery', category: 'learning_behavior', labels: ['topic_performance', 'topic_mastery'] },
  CONFIDENCE: { id: 'confidence', category: 'psychological_signal', labels: ['confidence_indicator', 'confidence'] },
  PANIC: { id: 'panic', category: 'psychological_signal', labels: ['panic', 'late_contest_panic', 'repeated_late_panic'] },
  PERSISTENCE: { id: 'persistence', category: 'psychological_signal', labels: ['persistence_score', 'persistence'] },
  FOCUS: { id: 'focus', category: 'psychological_signal', labels: ['focus_duration', 'focus_stability', 'attention_stability'] },
  FATIGUE: { id: 'fatigue', category: 'psychological_signal', labels: ['fatigue', 'idle_ratio'] },
  GRAPH_HESITATION: { id: 'graph_hesitation', category: 'behavioral_weakness', labels: ['graph_hesitation'] },
  DP_AVOIDANCE: { id: 'dp_avoidance', category: 'behavioral_weakness', labels: ['dp_avoidance', 'dynamic_programming_avoidance'] },
  IMPLEMENTATION_ERRORS: { id: 'implementation_errors', category: 'behavioral_weakness', labels: ['implementation_errors', 'wrong_answer_streak'] },
  TIME_MISMANAGEMENT: { id: 'time_mismanagement', category: 'behavioral_weakness', labels: ['time_mismanagement', 'late_contest_panic'] },
  STRESS_RESPONSE: { id: 'stress_response', category: 'behavioral_weakness', labels: ['stress_response', 'panic'] },
  CONCEPTUAL_WEAKNESS: { id: 'conceptual_weakness', category: 'behavioral_weakness', labels: ['conceptual_weakness'] }
});

const labelIndex = new Map();
for (const concept of Object.values(CONCEPTS)) {
  for (const label of concept.labels) labelIndex.set(label, concept);
}

function conceptForEvidence(evidence) {
  const payload = evidence.payload || {};
  const candidates = [
    payload.insight_key,
    payload.feature_name,
    payload.featureName,
    payload.pattern_key,
    payload.node_key,
    payload.label,
    evidence.identifier,
    evidence.type
  ].filter(Boolean).map((item) => String(item).toLowerCase());

  for (const candidate of candidates) {
    if (labelIndex.has(candidate)) return labelIndex.get(candidate);
    for (const [label, concept] of labelIndex.entries()) {
      if (candidate.includes(label)) return concept;
    }
  }
  return { id: 'unmapped_behavior', category: 'unknown', labels: [] };
}

function ontologyDocument() {
  return {
    version: ONTOLOGY_VERSION,
    concepts: Object.values(CONCEPTS)
  };
}

module.exports = { ONTOLOGY_VERSION, CONCEPTS, conceptForEvidence, ontologyDocument };

