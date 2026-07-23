const KNOWLEDGE_VERSION = 1;

class KnowledgeGraphBuilder {
  build({ userId, insights }) {
    const nodes = new Map();
    const edges = [];
    const userNode = this.node(nodes, {
      userId,
      nodeType: 'User',
      nodeKey: userId,
      label: `User ${userId}`,
      properties: {},
      version: KNOWLEDGE_VERSION
    });

    for (const insight of insights) {
      const target = this.node(nodes, {
        userId,
        nodeType: insight.targetNode.nodeType,
        nodeKey: insight.targetNode.nodeKey,
        label: insight.targetNode.label,
        properties: insight.properties,
        version: KNOWLEDGE_VERSION
      });
      edges.push(Object.freeze({
        userId,
        source: userNode,
        target,
        relationshipType: insight.relationshipType,
        confidence: insight.confidence,
        evidence: {
          insightKey: insight.insightKey,
          supportingFeatures: insight.supportingFeatures,
          evidenceSessions: insight.evidenceSessions
        },
        version: KNOWLEDGE_VERSION
      }));
    }

    return Object.freeze({
      nodes: [...nodes.values()],
      edges
    });
  }

  node(nodes, node) {
    const key = `${node.nodeType}:${node.nodeKey}`;
    if (!nodes.has(key)) nodes.set(key, Object.freeze(node));
    return nodes.get(key);
  }
}

module.exports = { KnowledgeGraphBuilder, KNOWLEDGE_VERSION };
