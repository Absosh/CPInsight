class PatternDetector {
  detect({ userId, insights, windowKey }) {
    const byKey = new Map();
    for (const insight of insights.filter((item) => item.category === 'pattern')) {
      if (!byKey.has(insight.insightKey)) byKey.set(insight.insightKey, []);
      byKey.get(insight.insightKey).push(insight);
    }
    return [...byKey.entries()].map(([patternKey, items]) => {
      const firstSeenAt = new Date().toISOString();
      const lastSeenAt = new Date().toISOString();
      return Object.freeze({
        userId,
        patternKey,
        patternType: patternKey,
        confidence: Number((items.reduce((sum, item) => sum + item.confidence, 0) / items.length).toFixed(4)),
        recurrenceCount: Math.max(...items.map((item) => item.properties.recurrenceCount || 1)),
        firstSeenAt,
        lastSeenAt,
        trend: items.length > 1 ? 'stable' : 'emerging',
        supportingInsights: items.map((item) => item.id).filter(Boolean),
        evidence: {
          windowKey,
          insightKeys: items.map((item) => item.insightKey)
        },
        version: 1
      });
    });
  }
}

module.exports = { PatternDetector };
