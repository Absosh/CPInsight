class RetrievalStrategy {
  constructor({ name, supportedIntents, description, priority, contextMultiplier }) {
    this.name = name;
    this.supportedIntents = new Set(supportedIntents);
    this.description = description;
    this.priority = priority;
    this.contextMultiplier = contextMultiplier;
  }

  supportsIntent(intent) {
    return this.supportedIntents.has(intent);
  }

  metadata() {
    return Object.freeze({
      name: this.name,
      supportedIntents: [...this.supportedIntents],
      description: this.description,
      priority: this.priority,
      contextMultiplier: this.contextMultiplier
    });
  }
}

module.exports = { RetrievalStrategy };

