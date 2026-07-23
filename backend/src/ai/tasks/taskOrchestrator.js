const crypto = require('crypto');
const { createDefaultAITaskRegistry } = require('./registry/factory');
const { createDefaultPromptStrategyRegistry } = require('./strategies/factory');
const { OutputSchemaRegistry } = require('./schemas/outputSchemaRegistry');
const { PolicyEngine } = require('./policies/policyEngine');

const AI_EXECUTION_PLAN_VERSION = 1;

function complexity(question, reasoningContext) {
  const words = String(question || '').trim().split(/\s+/).filter(Boolean).length;
  const findingCount = (reasoningContext.primaryFindings || []).length + (reasoningContext.secondaryFindings || []).length;
  const contradictionCount = (reasoningContext.contradictions || []).length;
  return Number(Math.min(1, (words / 40) * 0.35 + (findingCount / 12) * 0.45 + (contradictionCount / 4) * 0.2).toFixed(4));
}

class AITaskOrchestrator {
  constructor({
    taskRegistry = createDefaultAITaskRegistry(),
    strategyRegistry = createDefaultPromptStrategyRegistry(),
    schemaRegistry = new OutputSchemaRegistry(),
    policyEngine = new PolicyEngine()
  } = {}) {
    this.taskRegistry = taskRegistry;
    this.strategyRegistry = strategyRegistry;
    this.schemaRegistry = schemaRegistry;
    this.policyEngine = policyEngine;
  }

  route({ question, intent, reasoningContext }) {
    const intents = [
      intent && intent.primary,
      ...(intent && intent.secondary ? intent.secondary : []),
      ...(intent && intent.all ? intent.all : [])
    ].filter(Boolean);
    const plannerConfidence = intent && Number(intent.confidence || 0);
    const candidates = this.taskRegistry.supporting({ question, intents });
    const tasks = candidates.length ? candidates : [this.taskRegistry.get('unknown')];
    return tasks
      .map((task) => ({
        task,
        priority: task.priority({ reasoningContext, plannerConfidence }),
        reason: task.supports({ question, intents }) ? 'matched_intent_or_question' : 'fallback'
      }))
      .sort((a, b) => a.priority - b.priority || a.task.taskType.localeCompare(b.task.taskType));
  }

  async plan({ question, intent, reasoningContext, promptPackage }) {
    const startedAt = Date.now();
    const routed = this.route({ question, intent, reasoningContext });
    const primary = routed[0];
    const chained = new Set(primary.task.chainedTasks || []);
    for (const item of routed.slice(1, 4)) {
      if (item.priority <= primary.priority + 3) chained.add(item.task.taskType);
    }
    const selectedTaskTypes = [primary.task.taskType, ...[...chained].filter((taskType) => taskType !== primary.task.taskType)];
    const selectedTasks = selectedTaskTypes.map((taskType) => this.taskRegistry.get(taskType)).filter(Boolean);
    const taskPlans = [];
    for (const task of selectedTasks) {
      await task.initialize();
      taskPlans.push(Object.freeze({
        taskType: task.taskType,
        taskVersion: task.version(),
        reasoningMode: task.reasoningMode(),
        responseSchema: task.responseSchema(this.schemaRegistry),
        promptStrategy: task.promptStrategy(this.strategyRegistry, promptPackage),
        evaluationRules: task.evaluationRules(this.policyEngine),
        safetyPolicies: task.safetyPolicies(this.policyEngine),
        priority: routed.find((item) => item.task.taskType === task.taskType)?.priority ?? task.basePriority
      }));
      await task.destroy();
    }
    const plan = {
      executionPlanId: crypto.randomUUID(),
      executionPlanVersion: AI_EXECUTION_PLAN_VERSION,
      questionHash: promptPackage.reasoningContext.questionHash || reasoningContext.questionHash || null,
      reasoningContextId: reasoningContext.contextId,
      promptPackageId: promptPackage.promptPackageId,
      routing: {
        primaryTask: primary.task.taskType,
        taskChain: taskPlans.map((task) => task.taskType),
        routedCandidates: routed.map((item) => ({ taskType: item.task.taskType, priority: item.priority, reason: item.reason })),
        multiTask: taskPlans.length > 1,
        hierarchical: taskPlans.length > 1
      },
      tasks: taskPlans,
      reasoningModes: [...new Set(taskPlans.map((task) => task.reasoningMode))],
      outputSchemas: taskPlans.map((task) => ({
        taskType: task.taskType,
        name: selectedTasks.find((selectedTask) => selectedTask.taskType === task.taskType)?.schemaName || 'summary',
        ...task.responseSchema
      })),
      promptStrategies: taskPlans.map((task) => task.promptStrategy),
      evaluationRules: taskPlans.map((task) => ({ taskType: task.taskType, ...task.evaluationRules })),
      safetyConstraints: taskPlans.flatMap((task) => task.safetyPolicies.map((policy) => ({ taskType: task.taskType, ...policy }))),
      executionMetadata: {
        createdAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        complexity: complexity(question, reasoningContext),
        reasoningConfidence: reasoningContext.confidence || 0,
        plannerConfidence: intent ? Number(intent.confidence || 0) : 0,
        historicalImportance: (reasoningContext.historicalComparison && reasoningContext.historicalComparison.available) ? 1 : 0,
        noLLMInvocation: true
      }
    };
    return Object.freeze(plan);
  }

  tasks() {
    return this.taskRegistry.all().map((task) => ({
      taskType: task.taskType,
      taskVersion: task.version(),
      reasoningMode: task.reasoningMode(),
      schemaName: task.schemaName,
      strategyName: task.strategyName
    }));
  }

  strategies() {
    return this.strategyRegistry.all().map((strategy) => ({ id: strategy.id, version: strategy.version(), focus: strategy.focus }));
  }

  schemas() {
    return this.schemaRegistry.all();
  }

  policies() {
    return this.policyEngine.all();
  }
}

module.exports = { AITaskOrchestrator, AI_EXECUTION_PLAN_VERSION };
