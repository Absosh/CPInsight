// Analytics Service

class AnalyticsService {
  normalizeAnalytics(data) {
    if (!data) {
      return null;
    }

    return {
      platform: data.platform || 'combined',
      handle: data.handle || null,
      solvedProblems: data.solvedProblems || 0,
      solvedLastYear: data.solvedLastYear || 0,   // <-- ADD THIS
      solvedLastMonth: data.solvedLastMonth || 0, // <-- ADD THIS
      totalSubmissions: data.totalSubmissions ?? data.submissions ?? 0,
      acceptedSubmissions: data.acceptedSubmissions || 0,
      totalSubmissions: data.totalSubmissions ?? data.submissions ?? 0,
      acceptedSubmissions: data.acceptedSubmissions || 0,
      contestCount: data.contestCount || 0,
      currentRating: data.currentRating ?? null,
      maxRating: data.maxRating ?? null,
      activityHeatmap: data.activityHeatmap || {},
      topicStrength: data.topicStrength || [],
      ratingProgression: data.ratingProgression || [],
      streak: data.streak || 0,
      recentSubmissions: data.recentSubmissions || [],
      cpInsightScore: data.cpInsightScore ?? null,
      platforms: data.platforms || []
    };
  }

  async getCombinedAnalytics() {
    try {
      const data = await httpClient.get('/analytics/combined');
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch combined analytics:', err);
      return null;
    }
  }

  async getCodeforcesAnalytics() {
    try {
      const data = await httpClient.get('/analytics/codeforces');
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch Codeforces analytics:', err);
      return null;
    }
  }

  async getCodechefAnalytics() {
    try {
      const data = await httpClient.get('/analytics/codechef');
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch CodeChef analytics:', err);
      return null;
    }
  }

  async getLeetcodeAnalytics() {
    try {
      const data = await httpClient.get('/analytics/leetcode');
      return this.normalizeAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch LeetCode analytics:', err);
      return null;
    }
  }

  async getAnalytics(platform) {
    if (platform === 'combined') {
      return this.getCombinedAnalytics();
    }

    switch (platform) {
      case 'codeforces':
        return this.getCodeforcesAnalytics();
      case 'codechef':
        return this.getCodechefAnalytics();
      case 'leetcode':
        return this.getLeetcodeAnalytics();
      default:
        return this.getCombinedAnalytics();
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

    // For multiple platforms, use weighted formula
    const platformWeights = {
      'codeforces': 1.0,
      'codechef': 0.65,
      'leetcode': 0.85
    };

    // Competitive Rating Component (0.60*CF + 0.25*CC + 0.15*LC)
    let ratingComponent = 0;
    let ratingCount = 0;
    platformResults.forEach(result => {
      const platform = result.platform || 'codeforces';
      const rating = result.currentRating || 0;
      const ratingScore = Math.min(100, Math.round((rating / 2400) * 100));
      
      if (platform === 'codeforces') {
        ratingComponent += ratingScore * 0.60;
      } else if (platform === 'codechef') {
        ratingComponent += ratingScore * 0.25;
      } else if (platform === 'leetcode') {
        ratingComponent += ratingScore * 0.15;
      }
      ratingCount++;
    });

    // Problem Solving Component (0.50*LC + 0.30*CF + 0.20*CC)
    let solvingComponent = 0;
    let cfSolved = 0;
    let ccSolved = 0;
    let lcSolved = 0;

    platformResults.forEach(result => {
      const platform = result.platform || 'codeforces';
      if (platform === 'codeforces') cfSolved = result.solvedProblems || 0;
      if (platform === 'codechef') ccSolved = result.solvedProblems || 0;
      if (platform === 'leetcode') lcSolved = result.solvedProblems || 0;
    });

    const lcScore = this.getSolveScore(lcSolved);
    const cfScore = this.getSolveScore(cfSolved);
    const ccScore = this.getSolveScore(ccSolved);

    solvingComponent = lcScore * 0.50 + cfScore * 0.30 + ccScore * 0.20;

    // Consistency Component (based on combined streak)
    const consistencyComponent = Math.min(100, streak * 10);

    // Contest Participation Component
    const contestComponent = Math.min(100, totalContests * 5);

    // Topic Breadth Component (unique topics across all platforms)
    const breadthComponent = Math.min(100, topics.filter(t => t.accepted > 0).length * 8);

    // Calculate final CPInsight Score
    const cpScore = 
      0.40 * (ratingComponent / Math.max(1, ratingCount)) +
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
