class PromptStrategyRegistry {
  constructor() {
    this.strategies = new Map();
  }

  register(strategy) {
    if (!strategy || typeof strategy.supports !== 'function' || typeof strategy.build !== 'function') {
      throw new Error('Invalid prompt strategy');
    }
    if (this.strategies.has(strategy.id)) throw new Error(`Duplicate prompt strategy: ${strategy.id}`);
    this.strategies.set(strategy.id, strategy);
    return this;
  }

  forTask(taskType) {
    return this.all().filter((strategy) => strategy.supports(taskType));
  }

  all() {
    return [...this.strategies.values()];
  }
}

module.exports = { PromptStrategyRegistry };

