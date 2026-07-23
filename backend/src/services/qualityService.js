const { ValidationPipeline } = require('../ai/quality/pipeline/validationPipeline');
const { normalizeFeedback } = require('../ai/quality/feedback/feedbackEngine');
const repository = require('../repositories/qualityRepository');

class QualityService {
  constructor({ pipeline = new ValidationPipeline(), repo = repository } = {}) {
    this.pipeline = pipeline;
    this.repo = repo;
  }

  async validate(userId, input) {
    try {
      const result = this.pipeline.validate(input);
      await this.repo.withTransaction(async (db) => {
        await this.repo.insertValidation(userId, result, db);
        await this.repo.insertReflections(userId, result.validationId, result.behaviorReflections, db);
        await this.repo.insertValidationMetrics(userId, result, 'completed', null, db);
      });
      return result;
    } catch (error) {
      await this.repo.insertValidationMetrics(userId, {}, 'failed', error.message).catch(() => {});
      throw error;
    }
  }

  async storeReflections(userId, validationId, reflections) {
    return this.repo.insertReflections(userId, validationId, reflections);
  }

  async feedback(userId, body) {
    return this.repo.withTransaction((db) => this.repo.insertFeedback(userId, normalizeFeedback(body), db));
  }

  quality(userId, validationId) {
    return this.repo.getQuality(userId, validationId);
  }

  reflections(userId) {
    return this.repo.getReflections(userId);
  }

  feedbackMetrics() {
    return this.repo.getFeedbackMetrics();
  }

  validationMetrics(userId) {
    return this.repo.getValidationMetrics(userId);
  }
}

module.exports = new QualityService();
module.exports.QualityService = QualityService;
