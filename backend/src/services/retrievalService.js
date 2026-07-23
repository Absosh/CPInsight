const { RetrievalExecutionEngine } = require('../ai/retrieval/executionEngine');
const repository = require('../repositories/retrievalRepository');

class RetrievalService {
  constructor({ engine = new RetrievalExecutionEngine(), repo = repository } = {}) {
    this.engine = engine;
    this.repo = repo;
  }

  async execute(userId, plan, options = {}) {
    try {
      const evidencePackage = await this.engine.execute({ userId, plan, options });
      await this.repo.insertEvidencePackage(userId, evidencePackage);
      await this.repo.insertExecutionMetrics(userId, evidencePackage);
      await this.repo.insertSourceMetrics(userId, evidencePackage);
      await this.repo.insertFusionMetrics(userId, evidencePackage);
      return evidencePackage;
    } catch (error) {
      await this.repo.insertExecutionMetrics(userId, {}, 'failed', error.message).catch(() => {});
      throw error;
    }
  }

  getPackage(userId, packageId) {
    return this.repo.getPackage(userId, packageId);
  }

  cache() {
    return this.engine.cacheStats();
  }

  metrics(userId, limit) {
    return this.repo.getMetrics(userId, limit);
  }

  sources() {
    return this.engine.sources();
  }

  health() {
    const sources = this.sources();
    return {
      healthy: sources.every((source) => source.healthy),
      sources,
      cache: this.cache()
    };
  }
}

module.exports = new RetrievalService();
module.exports.RetrievalService = RetrievalService;

