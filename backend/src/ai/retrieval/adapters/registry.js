class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    if (!adapter || typeof adapter.supports !== 'function' || typeof adapter.retrieve !== 'function') {
      throw new Error('Invalid retrieval adapter');
    }
    if (this.adapters.has(adapter.name)) throw new Error(`Duplicate retrieval adapter: ${adapter.name}`);
    this.adapters.set(adapter.name, adapter);
    return this;
  }

  resolve(source) {
    return [...this.adapters.values()].find((adapter) => adapter.supports(source)) || null;
  }

  all() {
    return [...this.adapters.values()];
  }

  health() {
    return this.all().map((adapter) => adapter.health());
  }
}

module.exports = { AdapterRegistry };

