const crypto = require('crypto');
const pool = require('../database/pool');
const behaviorRepository = require('../repositories/behaviorRepository');
const { SessionReconstructor } = require('../behavior/reconstruction/sessionReconstructor');
const { ContestReconstructor } = require('../behavior/reconstruction/contestReconstructor');
const { createDefaultExtractorRegistry } = require('../behavior/extractors/factory');
const { BehaviorProfileAggregator } = require('../behavior/profile/profileAggregator');

function confidenceDistribution(features) {
  return features.reduce((acc, feature) => {
    const bucket = feature.confidence >= 0.75 ? 'high' : feature.confidence >= 0.45 ? 'medium' : 'low';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

class BehaviorIntelligenceService {
  constructor({
    repository = behaviorRepository,
    sessionReconstructor = new SessionReconstructor(),
    contestReconstructor = new ContestReconstructor(),
    extractorRegistry = createDefaultExtractorRegistry(),
    profileAggregator = new BehaviorProfileAggregator()
  } = {}) {
    this.repository = repository;
    this.sessionReconstructor = sessionReconstructor;
    this.contestReconstructor = contestReconstructor;
    this.extractorRegistry = extractorRegistry;
    this.profileAggregator = profileAggregator;
  }

  async runExtraction(userId, options = {}) {
    const startedAt = Date.now();
    const runId = crypto.randomUUID();
    const client = await pool.connect();
    try {
      const rows = await this.repository.getTelemetryEvents(userId, options);
      const sessions = this.sessionReconstructor.reconstruct(rows);
      const allInsertedFeatures = [];
      await client.query('BEGIN');
      for (const session of sessions) {
        const sessionRow = await this.repository.insertSession(userId, session, client);
        const contest = this.contestReconstructor.reconstruct(session);
        const extracted = [];
        for (const extractor of this.extractorRegistry.all()) {
          await extractor.initialize();
          if (extractor.supports(session, { contest })) {
            extracted.push(...extractor.extract(session, { contest }));
          }
          await extractor.destroy();
        }
        const inserted = await this.repository.insertFeatures({
          userId,
          sessionRow,
          session,
          features: extracted,
          windowKey: 'session'
        }, client);
        allInsertedFeatures.push(...inserted);
      }
      const profile = this.profileAggregator.aggregate({
        userId,
        features: allInsertedFeatures,
        windowKey: options.windowKey || 'all',
        platform: options.platform || null
      });
      const profileRow = await this.repository.insertProfile(profile, client);
      const metrics = await this.repository.insertMetrics({
        userId,
        runId,
        sessionsReconstructed: sessions.length,
        featuresExtracted: allInsertedFeatures.length,
        extractionLatencyMs: Date.now() - startedAt,
        confidenceDistribution: confidenceDistribution(allInsertedFeatures),
        incompleteSessions: sessions.filter((session) => session.reconstructionMetadata.incomplete).length,
        failedReconstructions: 0,
        featureVersion: 1,
        status: 'completed'
      }, client);
      await client.query('COMMIT');
      return {
        runId,
        sessionsReconstructed: sessions.length,
        featuresExtracted: allInsertedFeatures.length,
        profile: profileRow,
        metrics
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      await this.repository.insertMetrics({
        userId,
        runId,
        status: 'failed',
        errorMessage: error.message,
        extractionLatencyMs: Date.now() - startedAt,
        featureVersion: 1
      }).catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessions(userId, limit) {
    return this.repository.getSessions(userId, limit);
  }

  async getProfile(userId, windowKey) {
    return this.repository.getLatestProfile(userId, windowKey);
  }

  async getFeatures(userId, query) {
    return this.repository.getFeatures(userId, query);
  }

  async getTrends(userId, query = {}) {
    const features = await this.repository.getFeatures(userId, { ...query, limit: 1000 });
    return features.reduce((acc, feature) => {
      if (!acc[feature.feature_name]) acc[feature.feature_name] = [];
      acc[feature.feature_name].push({
        value: feature.value,
        confidence: Number(feature.confidence),
        createdAt: feature.created_at,
        windowKey: feature.window_key
      });
      return acc;
    }, {});
  }

  async compareFeatures(userId, featureName) {
    const features = await this.repository.getFeatures(userId, { featureName, limit: 100 });
    return {
      featureName,
      latest: features[0] || null,
      previous: features[1] || null,
      delta: features.length > 1 && typeof features[0].value === 'number' && typeof features[1].value === 'number'
        ? features[0].value - features[1].value
        : null
    };
  }
}

module.exports = new BehaviorIntelligenceService();
module.exports.BehaviorIntelligenceService = BehaviorIntelligenceService;
