const { ontologyDocument } = require('../ai/reasoning/ontology/behaviorOntology');
const { buildReasoningContext } = require('../ai/reasoning/context/contextBuilder');
const { buildPromptPackage } = require('../ai/reasoning/prompts/promptOrchestrator');
const repository = require('../repositories/reasoningRepository');

class ReasoningService {
  constructor({ repo = repository } = {}) {
    this.repo = repo;
  }

  async createContext(userId, evidencePackage, options = {}) {
    try {
      const context = buildReasoningContext(evidencePackage, options);
      await this.repo.insertContext(userId, context);
      await this.repo.insertReasoningMetrics(userId, context);
      await this.repo.insertCompressionMetrics(userId, context);
      return context;
    } catch (error) {
      await this.repo.insertReasoningMetrics(userId, {}, null, 'failed', error.message).catch(() => {});
      throw error;
    }
  }

  async createPrompt(userId, reasoningContext, options = {}) {
    const promptPackage = buildPromptPackage(reasoningContext, options);
    await this.repo.insertPromptPackage(userId, promptPackage);
    await this.repo.insertReasoningMetrics(userId, reasoningContext, promptPackage);
    return promptPackage;
  }

  ontology() {
    return ontologyDocument();
  }

  getContext(userId, contextId) {
    return this.repo.getContext(userId, contextId);
  }

  getPrompt(userId, promptId) {
    return this.repo.getPrompt(userId, promptId);
  }

  metrics(userId, limit) {
    return this.repo.getMetrics(userId, limit);
  }
}

module.exports = new ReasoningService();
module.exports.ReasoningService = ReasoningService;

