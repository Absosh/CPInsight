function latestValue(features, name) {
  const item = features.find((feature) => feature.featureName === name);
  return item ? { value: item.value, confidence: item.confidence } : { value: null, confidence: 0 };
}

function averageConfidence(features) {
  if (!features.length) return 0;
  return Number((features.reduce((sum, feature) => sum + feature.confidence, 0) / features.length).toFixed(4));
}

class BehaviorProfileAggregator {
  aggregate({ userId, features, windowKey = 'all', platform = null }) {
    return Object.freeze({
      userId,
      profileWindow: windowKey,
      platform,
      profileVersion: 1,
      readingStyle: {
        readingDepth: latestValue(features, 'reading_depth'),
        rereadFrequency: latestValue(features, 'reread_frequency')
      },
      decisionStyle: {
        hesitation: latestValue(features, 'hesitation_score'),
        confidence: latestValue(features, 'confidence_indicator')
      },
      attentionPattern: {
        stability: latestValue(features, 'attention_stability'),
        idleRatio: latestValue(features, 'idle_ratio')
      },
      contestStrategy: {
        riskAppetite: latestValue(features, 'risk_appetite'),
        latePanic: latestValue(features, 'late_contest_panic')
      },
      persistence: {
        persistenceScore: latestValue(features, 'persistence_score'),
        recoveryRate: latestValue(features, 'recovery_rate')
      },
      riskProfile: {
        riskAppetite: latestValue(features, 'risk_appetite'),
        overcommitment: latestValue(features, 'overcommitment')
      },
      stressProfile: {
        lateContestPanic: latestValue(features, 'late_contest_panic'),
        comebackBehavior: latestValue(features, 'comeback_behavior')
      },
      learningStyle: {
        challengePreference: latestValue(features, 'challenge_preference'),
        explorationScore: latestValue(features, 'exploration_score')
      },
      timeManagement: {
        timeAllocationBalance: latestValue(features, 'time_allocation_balance'),
        activeRatio: latestValue(features, 'active_coding_ratio')
      },
      confidence: averageConfidence(features),
      featureIds: features.map((feature) => feature.id).filter(Boolean)
    });
  }
}

module.exports = { BehaviorProfileAggregator };
