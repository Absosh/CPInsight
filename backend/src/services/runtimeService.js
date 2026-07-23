const { LLMRuntimeEngine } = require('../ai/runtime/runtimeEngine');
const repository = require('../repositories/runtimeRepository');

class RuntimeService {
  constructor({ engine = new LLMRuntimeEngine(), repo = repository } = {}) {
    this.engine = engine;
    this.repo = repo;
  }

  async execute(userId, input, stream = false) {
    try {
      const result = await this.engine.execute({ userId, ...input, stream });
      await this.repo.insertRuntimeResult(userId, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  cancel(runtimeRequestId) {
    return this.engine.cancel(runtimeRequestId);
  }

  providers() {
    return this.engine.providers();
  }

  models() {
    return this.engine.models();
  }

  metrics(userId, limit) {
    return this.repo.getMetrics(userId, limit);
  }

  health() {
    return this.engine.health();
  }
}

module.exports = new RuntimeService();
module.exports.RuntimeService = RuntimeService;

