class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
  }

  register(strategy) {
    if (!strategy || typeof strategy.supportsIntent !== 'function' || typeof strategy.metadata !== 'function') {
      throw new Error('Invalid retrieval strategy');
    }
    const metadata = strategy.metadata();
    if (this.strategies.has(metadata.name)) throw new Error(`Duplicate retrieval strategy: ${metadata.name}`);
    this.strategies.set(metadata.name, strategy);
    return this;
  }

  all() {
    return [...this.strategies.values()];
  }

  forIntents(intents) {
    const requested = new Set(intents);
    return this.all()
      .filter((strategy) => [...requested].some((intent) => strategy.supportsIntent(intent)))
      .sort((a, b) => a.metadata().priority - b.metadata().priority);
  }
}

module.exports = { StrategyRegistry };

