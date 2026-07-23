class AITask {
  constructor({
    taskType,
    taskVersion = 1,
    supportedIntents,
    keywords = [],
    basePriority = 10,
    reasoningMode,
    schemaName,
    strategyName,
    evaluationGroup = 'general',
    policyGroup = 'general',
    chainedTasks = []
  }) {
    this.taskType = taskType;
    this.taskVersion = taskVersion;
    this.supportedIntents = new Set(supportedIntents);
    this.keywords = keywords;
    this.basePriority = basePriority;
    this.mode = reasoningMode;
    this.schemaName = schemaName;
    this.strategyName = strategyName;
    this.evaluationGroup = evaluationGroup;
    this.policyGroup = policyGroup;
    this.chainedTasks = chainedTasks;
  }

  async initialize() {}

  supports({ question = '', intents = [] }) {
    const lower = question.toLowerCase();
    return intents.some((intent) => this.supportedIntents.has(intent)) || this.keywords.some((keyword) => lower.includes(keyword));
  }

  priority({ reasoningContext = {}, plannerConfidence = 0 }) {
    const confidenceBoost = Math.round((reasoningContext.confidence || 0) * 10);
    const plannerBoost = Math.round(plannerConfidence * 5);
    const evidencePenalty = (reasoningContext.missingEvidence || []).length;
    return this.basePriority - confidenceBoost - plannerBoost + evidencePenalty;
  }

  reasoningMode() {
    return this.mode;
  }

  responseSchema(schemaRegistry) {
    return schemaRegistry.get(this.schemaName);
  }

  promptStrategy(strategyRegistry, promptPackage) {
    const exact = strategyRegistry.all().find((strategy) => strategy.id === this.strategyName);
    return exact ? exact.build(this, promptPackage) : strategyRegistry.forTask(this.taskType)[0].build(this, promptPackage);
  }

  evaluationRules(policyEngine) {
    return policyEngine.evaluationRules(this);
  }

  safetyPolicies(policyEngine) {
    return policyEngine.safetyPolicies(this);
  }

  version() {
    return this.taskVersion;
  }

  async destroy() {}
}

module.exports = { AITask };

