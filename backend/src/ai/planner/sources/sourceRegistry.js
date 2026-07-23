class SourceRegistry {
  constructor() {
    this.sources = new Map();
  }

  register(source) {
    if (!source || typeof source.supportsIntent !== 'function' || typeof source.metadata !== 'function') {
      throw new Error('Invalid retrieval source');
    }
    const metadata = source.metadata();
    if (this.sources.has(metadata.name)) throw new Error(`Duplicate retrieval source: ${metadata.name}`);
    this.sources.set(metadata.name, source);
    return this;
  }

  all() {
    return [...this.sources.values()];
  }

  forIntents(intents) {
    const requested = new Set(intents);
    return this.all().filter((source) => [...requested].some((intent) => source.supportsIntent(intent)));
  }
}

module.exports = { SourceRegistry };

