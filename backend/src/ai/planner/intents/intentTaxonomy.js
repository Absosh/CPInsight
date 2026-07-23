const INTENTS = Object.freeze({
  DIAGNOSTIC: 'diagnostic',
  COMPARATIVE: 'comparative',
  PREDICTIVE: 'predictive',
  COACHING: 'coaching',
  REFLECTIVE: 'reflective',
  EXPLORATORY: 'exploratory',
  EVIDENCE_REQUEST: 'evidence_request',
  HISTORICAL_REVIEW: 'historical_review',
  TREND_ANALYSIS: 'trend_analysis',
  GOAL_PLANNING: 'goal_planning',
  UNKNOWN: 'unknown'
});

const INTENT_DEFINITIONS = Object.freeze([
  {
    intent: INTENTS.DIAGNOSTIC,
    description: 'Explains causes behind an observed outcome or behavior.',
    examples: ['Why did my rating drop?', 'Why do I panic late?']
  },
  {
    intent: INTENTS.COMPARATIVE,
    description: 'Compares contests, sessions, platforms, topics, or historical windows.',
    examples: ['Compare my last five contests.']
  },
  {
    intent: INTENTS.PREDICTIVE,
    description: 'Estimates likely future outcomes or readiness from existing evidence.',
    examples: ['Can I solve harder problems next month?']
  },
  {
    intent: INTENTS.COACHING,
    description: 'Asks for practice direction or improvement guidance.',
    examples: ['What should I practice?']
  },
  {
    intent: INTENTS.REFLECTIVE,
    description: 'Asks for self-understanding, patterns, strengths, or weaknesses.',
    examples: ['What kind of solver am I?']
  },
  {
    intent: INTENTS.EXPLORATORY,
    description: 'Open-ended discovery over available behavior data.',
    examples: ['Show me something interesting about my contests.']
  },
  {
    intent: INTENTS.EVIDENCE_REQUEST,
    description: 'Asks why the system believes a claim or requests proof.',
    examples: ['Why do you think I panic?']
  },
  {
    intent: INTENTS.HISTORICAL_REVIEW,
    description: 'Looks back over past contests, sessions, or time windows.',
    examples: ['Review my last month.']
  },
  {
    intent: INTENTS.TREND_ANALYSIS,
    description: 'Asks whether a behavior or outcome is increasing, decreasing, or stable.',
    examples: ['Am I improving?']
  },
  {
    intent: INTENTS.GOAL_PLANNING,
    description: 'Plans practice or targets toward a future goal.',
    examples: ['How do I reach specialist?']
  }
]);

module.exports = { INTENTS, INTENT_DEFINITIONS };

