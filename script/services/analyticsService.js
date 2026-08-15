// Analytics Service

class AnalyticsService {
  normalizeAnalytics(data) {
    if (!data) {
      return null;
    }

    return {
      platform: data.platform || 'combined',
      handle: data.handle || null,
      syncStatus: data.syncStatus || null,
      lastSyncedAt: data.lastSyncedAt || null,
      dataAvailability: data.dataAvailability || {},
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      solvedProblems: data.solvedProblems || 0,
      solvedLastYear: data.solvedLastYear || 0,
      solvedLastMonth: data.solvedLastMonth || 0,
      totalSubmissions: data.totalSubmissions ?? data.submissions ?? 0,
      acceptedSubmissions: data.acceptedSubmissions || 0,
      contestCount: data.contestCount || 0,
      currentRating: data.currentRating ?? null,
      maxRating: data.maxRating ?? null,
      activityHeatmap: data.activityHeatmap || {},
      activityIntelligence: data.activityIntelligence || null,
      topicStrength: data.topicStrength || [],
      difficultyIntelligence: data.difficultyIntelligence || null,
      contestIntelligence: data.contestIntelligence || null,
      ratingProgression: data.ratingProgression || [],
      ratingChange: data.ratingChange ?? null,
      streak: data.streak || 0,
      recentSubmissions: data.recentSubmissions || [],
      cpInsightScore: data.cpInsightScore ?? null,
      platforms: data.platforms || [],
      skippedPlatforms: data.skippedPlatforms || [],
      analyticsVersion: data.analyticsVersion || null
    };
  }

  async getCombinedAnalytics() {
    try {
      const data = await httpClient.get('/analytics/combined');
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch combined analytics:', err);
      throw err;
    }
  }

  async getAnalytics(platform) {
    if (platform === 'combined') {
      return this.getCombinedAnalytics();
    }

    try {
      const data = await httpClient.get(`/analytics/${encodeURIComponent(platform)}`);
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error(`Failed to fetch ${platform} analytics:`, err);
      throw err;
    }
  }

  async getMultiplePlatforms(platforms) {
    try {
      const requests = platforms.map(p => this.getAnalytics(p));
      const results = await Promise.all(requests);
      return this.mergeAnalytics(platforms, results);
    } catch (err) {
      console.error('Failed to fetch multiple analytics:', err);
      return null;
    }
  }

  mergeAnalytics(platforms, analyticsArray) {
    const results = analyticsArray
      .map((analytics) => this.normalizeAnalytics(analytics))
      .filter(Boolean);

    if (results.length === 1) {
      return results[0];
    }

    if (results.length === 0) {
      return this.normalizeAnalytics({});
    }

    const topicMap = {};
    const activityHeatmap = {};
    let solvedLastYear = 0;  // <-- ADD THIS
    let solvedLastMonth = 0; // <-- ADD THIS
    const ratingProgression = [];
    const recentSubmissions = [];
    let solvedProblems = 0;
    let totalSubmissions = 0;
    let acceptedSubmissions = 0;
    let contestCount = 0;
    let streak = 0;
    let maxRating = null;

    results.forEach((analytics, index) => {
      solvedProblems += analytics.solvedProblems || 0;
      solvedLastYear += analytics.solvedLastYear || 0;   // <-- ADD THIS
      solvedLastMonth += analytics.solvedLastMonth || 0; // <-- ADD THIS
      totalSubmissions += analytics.totalSubmissions || 0;
      acceptedSubmissions += analytics.acceptedSubmissions || 0;
      contestCount += analytics.contestCount || 0;
      streak = Math.max(streak, analytics.streak || 0);

      if (typeof analytics.maxRating === 'number') {
        maxRating = maxRating === null ? analytics.maxRating : Math.max(maxRating, analytics.maxRating);
      }

      Object.entries(analytics.activityHeatmap || {}).forEach(([day, count]) => {
        activityHeatmap[day] = (activityHeatmap[day] || 0) + count;
      });

      (analytics.topicStrength || []).forEach((topic) => {
        const existing = topicMap[topic.topic] || { topic: topic.topic, attempts: 0, accepted: 0 };
        existing.attempts += topic.attempts || 0;
        existing.accepted += topic.accepted || 0;
        topicMap[topic.topic] = existing;
      });

      (analytics.ratingProgression || []).forEach((point) => {
        ratingProgression.push({
          ...point,
          platform: point.platform || platforms[index] || analytics.platform
        });
      });

      (analytics.recentSubmissions || []).forEach((submission) => {
        recentSubmissions.push({
          ...submission,
          platform: submission.platform || platforms[index] || analytics.platform
        });
      });
    });

    const topicStrength = Object.values(topicMap)
      .map((topic) => ({
        ...topic,
        strength: topic.attempts === 0 ? 0 : Math.round((topic.accepted / topic.attempts) * 100)
      }))
      .sort((a, b) => {
        if (b.accepted !== a.accepted) return b.accepted - a.accepted;
        return b.strength - a.strength;
      });

    ratingProgression.sort((a, b) => new Date(a.participatedAt) - new Date(b.participatedAt));
    recentSubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Calculate combined streak from heatmap (a day is active if ANY platform has activity)
    const combinedStreak = this.calculateCombinedStreak(activityHeatmap);

    // Calculate CPInsight Score with platform-weighted formula
    const cpInsightScore = this.calculateCPInsightScore(results, solvedProblems, contestCount, combinedStreak, topicStrength);

    return this.normalizeAnalytics({
      platform: results.length > 1 ? 'combined' : results[0]?.platform,
      solvedProblems,
      solvedLastYear,
      solvedLastMonth,
      totalSubmissions,
      acceptedSubmissions,
      contestCount,
      currentRating: results.length === 1 ? results[0].currentRating : null,
      maxRating,
      activityHeatmap,
      topicStrength,
      ratingProgression,
      recentSubmissions: recentSubmissions.slice(0, 30),
      streak: combinedStreak,
      cpInsightScore,
      platforms: results
    });
  }

  calculateCombinedStreak(heatmap) {
    // Get all unique dates sorted descending (most recent first)
    const dates = Object.keys(heatmap)
      .map(d => new Date(d))
      .sort((a, b) => b - a);

    if (dates.length === 0) return 0;

    let currentStreak = 0;
    let maxStreak = 0;
    let lastDate = null;

    for (const date of dates) {
      if (lastDate === null) {
        currentStreak = 1;
        lastDate = new Date(date);
      } else {
        const expectedDate = new Date(lastDate);
        expectedDate.setDate(expectedDate.getDate() - 1);

        // Check if dates are consecutive (within 1 day)
        const diff = (lastDate - date) / (1000 * 60 * 60 * 24);
        if (Math.abs(diff - 1) < 0.1) {
          currentStreak++;
          lastDate = new Date(date);
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
          lastDate = new Date(date);
        }
      }
    }

    return Math.max(maxStreak, currentStreak);
  }

  calculateCPInsightScore(platformResults, totalSolved, totalContests, streak, topics) {
    // For single platform, use simple calculation
    if (platformResults.length === 1) {
      const latestRating = platformResults[0].currentRating || 0;
      const ratingScore = Math.min(100, Math.round((latestRating / 2400) * 100));
      const solveScore = Math.min(100, Math.round((totalSolved / 500) * 100));
      const consistencyScore = Math.min(100, streak * 10);
      const contestScore = Math.min(100, totalContests * 5);
      const breadthScore = Math.min(100, topics.filter(t => t.accepted > 0).length * 8);

      return Math.round(
        0.40 * ratingScore +
        0.25 * solveScore +
        0.15 * consistencyScore +
        0.10 * contestScore +
        0.10 * breadthScore
      );
    }

    const ratingScores = platformResults
      .map(result => result.currentRating)
      .filter(rating => typeof rating === 'number')
      .map(rating => Math.min(100, Math.round((rating / 2400) * 100)));
    const ratingComponent = ratingScores.length
      ? ratingScores.reduce((sum, score) => sum + score, 0) / ratingScores.length
      : 0;
    const solvingComponent = this.getSolveScore(totalSolved);

    // Consistency Component (based on combined streak)
    const consistencyComponent = Math.min(100, streak * 10);

    // Contest Participation Component
    const contestComponent = Math.min(100, totalContests * 5);

    // Topic Breadth Component (unique topics across all platforms)
    const breadthComponent = Math.min(100, topics.filter(t => t.accepted > 0).length * 8);

    // Calculate final CPInsight Score
    const cpScore = 
      0.40 * ratingComponent +
      0.25 * solvingComponent +
      0.15 * consistencyComponent +
      0.10 * contestComponent +
      0.10 * breadthComponent;

    return Math.round(Math.min(100, cpScore));
  }

  getSolveScore(solved) {
    if (solved === 0) return 0;
    if (solved <= 100) return 20;
    if (solved <= 200) return 40;
    if (solved <= 400) return 60;
    if (solved <= 700) return 80;
    return 100;
  }
}

const analyticsService = new AnalyticsService();
window.analyticsService = analyticsService;
