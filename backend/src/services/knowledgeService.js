const crypto = require('crypto');
const pool = require('../database/pool');
const repository = require('../repositories/knowledgeRepository');
const { createDefaultInsightRuleRegistry } = require('../knowledge/rules/factory');
const { KnowledgeGraphBuilder } = require('../knowledge/graph/graphBuilder');
const { PatternDetector } = require('../knowledge/patterns/patternDetector');

function confidenceDistribution(insights) {
  return insights.reduce((acc, insight) => {
    const bucket = insight.confidence >= 0.75 ? 'high' : insight.confidence >= 0.45 ? 'medium' : 'low';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

class KnowledgeService {
  constructor({
    repo = repository,
    ruleRegistry = createDefaultInsightRuleRegistry(),
    graphBuilder = new KnowledgeGraphBuilder(),
    patternDetector = new PatternDetector()
  } = {}) {
    this.repo = repo;
    this.ruleRegistry = ruleRegistry;
    this.graphBuilder = graphBuilder;
    this.patternDetector = patternDetector;
  }

  async infer(userId, options = {}) {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();
    const client = await pool.connect();
    try {
      const features = await this.repo.getBehaviorFeatures(userId, options);
      const inferred = [];
      for (const rule of this.ruleRegistry.all()) {
        await rule.initialize();
        if (rule.supports({ features, options })) inferred.push(...rule.infer({ features, options }));
        await rule.destroy();
      }
      const graph = this.graphBuilder.build({ userId, insights: inferred });
      await client.query('BEGIN');
      const insertedNodesByKey = new Map();
      for (const node of graph.nodes) {
        const inserted = await this.repo.insertNode(node, client);
        insertedNodesByKey.set(`${node.nodeType}:${node.nodeKey}`, inserted);
      }
      const insertedInsights = [];
      for (const insight of inferred) {
        const row = await this.repo.insertInsight(userId, insight, options.windowKey || 'all', client);
        insertedInsights.push({ ...insight, id: row.id });
        await this.repo.insertEvidence(row.id, insight, client);
      }
      for (const edge of graph.edges) {
        const source = insertedNodesByKey.get(`${edge.source.nodeType}:${edge.source.nodeKey}`);
        const target = insertedNodesByKey.get(`${edge.target.nodeType}:${edge.target.nodeKey}`);
        await this.repo.insertEdge(edge, source.id, target.id, client);
      }
      const patterns = this.patternDetector.detect({
        userId,
        insights: insertedInsights,
        windowKey: options.windowKey || 'all'
      });
      for (const pattern of patterns) await this.repo.insertPattern(pattern, client);
      const metrics = await this.repo.insertMetrics({
        userId,
        runId,
        insightsGenerated: insertedInsights.length,
        rulesFired: inferred.length,
        inferenceLatencyMs: Date.now() - startedAt,
        confidenceDistribution: confidenceDistribution(inferred),
        graphNodes: graph.nodes.length,
        graphEdges: graph.edges.length,
        patternCount: patterns.length,
        status: 'completed'
      }, client);
      await client.query('COMMIT');
      return {
        runId,
        insightsGenerated: insertedInsights.length,
        graphNodes: graph.nodes.length,
        graphEdges: graph.edges.length,
        patternCount: patterns.length,
        metrics
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      await this.repo.insertMetrics({
        userId,
        runId,
        status: 'failed',
        errorMessage: error.message,
        inferenceLatencyMs: Date.now() - startedAt
      }).catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  graph(userId) {
    return this.repo.getGraph(userId);
  }

  strengths(userId) {
    return this.repo.getInsights(userId, 'strength');
  }

  weaknesses(userId) {
    return this.repo.getInsights(userId, 'weakness');
  }

  patterns(userId) {
    return this.repo.getPatterns(userId);
  }

  evolution(userId) {
    return this.repo.getInsights(userId, null);
  }

  evidence(userId, insightId) {
    return this.repo.getEvidence(userId, insightId);
  }
}

module.exports = new KnowledgeService();
module.exports.KnowledgeService = KnowledgeService;
