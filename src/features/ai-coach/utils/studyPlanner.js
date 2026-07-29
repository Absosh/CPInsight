import { buildTopicPracticeUrl, normalizeTopicDisplayName, topicMappings } from './topicMappings.js';

const TOPIC_ALIAS = topicMappings.reduce((aliases, mapping) => {
  aliases[mapping.displayName.toLowerCase()] = mapping.displayName;
  mapping.aliases.forEach((alias) => {
    aliases[alias.toLowerCase()] = mapping.displayName;
  });
  return aliases;
}, {});

const TARGET_TOPIC_REQUIREMENTS = [
  { min: 1200, topics: ['Implementation', 'Greedy', 'Math', 'Binary Search'] },
  { min: 1400, topics: ['Implementation', 'Greedy', 'Binary Search', 'Sorting', 'Two Pointers'] },
  { min: 1600, topics: ['Dynamic Programming', 'Graphs', 'Trees', 'Binary Search', 'Greedy'] },
  { min: 1800, topics: ['Dynamic Programming', 'Graphs', 'Shortest Paths', 'Trees', 'Combinatorics'] },
  { min: 1900, topics: ['Dynamic Programming', 'Advanced Graphs', 'Number Theory', 'Data Structures'] },
  { min: 2000, topics: ['Dynamic Programming', 'Advanced Graphs', 'Segment Trees', 'Game Theory'] },
  { min: 2100, topics: ['Advanced Graphs', 'Dynamic Programming', 'Flows', 'Geometry', 'Advanced Data Structures'] }
];

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeConfidence(value, fallback = 0.72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number > 1 ? clamp(number, 0, 100) / 100 : clamp(number, 0, 1);
}

function titleCase(value) {
  const text = String(value || '').replace(/[_-]/g, ' ').trim();
  if (!text) return 'General Practice';
  const alias = normalizeTopicDisplayName(text);
  if (alias !== 'General Practice') return alias;
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function list(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function latestReviewPayload(review = {}) {
  const response = review.validatedResponse || review.validated_response || {};
  return {
    title: review.title || response.summary || 'Latest contest review',
    generatedAt: review.createdAt || review.created_at,
    recommendations: list(review.recommendations).length ? list(review.recommendations) : list(response.recommendations),
    reflections: list(review.reflections),
    roadmap: review.roadmap || {},
    confidence: normalizeConfidence(response.confidence || review.reviewConfidence || review.review_confidence || review.qualityReport?.overallQualityScore || review.quality_report?.overallQualityScore)
  };
}

function topicFromRecommendation(item) {
  const text = [
    item.topic,
    item.title,
    item.recommendation,
    item.description,
    item.nextAction
  ].filter(Boolean).join(' ').toLowerCase();
  for (const [key, value] of Object.entries(TOPIC_ALIAS)) {
    if (text.includes(key)) return value;
  }
  return titleCase(item.topic || item.category || 'Implementation');
}

function requiredTopicsForTarget(targetRating) {
  const target = Number(targetRating) || 1600;
  return TARGET_TOPIC_REQUIREMENTS
    .filter((bracket) => target >= bracket.min)
    .flatMap((bracket) => bracket.topics)
    .filter((topic, index, topics) => topics.indexOf(topic) === index);
}

function buildTopicInputs({ analytics = {}, latestReview = {}, reflections = [], targetRating }) {
  const topicMap = new Map();

  function ensureTopic(name) {
    const key = titleCase(name);
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        topic: key,
        attempts: 0,
        accepted: 0,
        mastery: 35,
        reviewHits: 0,
        reflectionHits: 0,
        recommendationHits: 0,
        requiredForTarget: false,
        confidenceSamples: [],
        reasons: []
      });
    }
    return topicMap.get(key);
  }

  list(analytics.topicStrength).forEach((topic) => {
    const item = ensureTopic(topic.topic || topic.name);
    item.attempts += Number(topic.attempts || 0);
    item.accepted += Number(topic.accepted || 0);
    item.mastery = clamp(topic.strength ?? (item.attempts ? (item.accepted / item.attempts) * 100 : item.mastery));
    item.confidenceSamples.push(item.attempts >= 10 ? 0.82 : 0.64);
    item.reasons.push(`${item.attempts || 'Recent'} attempts with ${item.mastery}% solved accuracy.`);
  });

  const review = latestReviewPayload(latestReview);
  review.recommendations.forEach((recommendation) => {
    const item = ensureTopic(topicFromRecommendation(recommendation));
    item.recommendationHits += 1;
    item.reviewHits += 1;
    item.confidenceSamples.push(normalizeConfidence(recommendation.confidence || recommendation.expectedImpact, review.confidence));
    item.reasons.push(recommendation.reason || recommendation.description || recommendation.recommendation || 'Recommended by the latest validated contest review.');
  });

  [...review.reflections, ...list(reflections)].forEach((reflection) => {
    const item = ensureTopic(topicFromRecommendation(reflection));
    item.reflectionHits += 1;
    item.confidenceSamples.push(normalizeConfidence(reflection.confidence));
    item.reasons.push(reflection.behaviorFinding || reflection.type || 'Supported by reflection memory.');
  });

  requiredTopicsForTarget(targetRating).forEach((topic) => {
    const item = ensureTopic(topic);
    item.requiredForTarget = true;
    item.reasons.push(`Relevant to the selected ${targetRating || 1600} target rating bracket.`);
  });

  if (!topicMap.size) {
    ['Implementation', 'Greedy', 'Binary Search', 'Dynamic Programming'].forEach((topic) => {
      const item = ensureTopic(topic);
      item.reasons.push('Baseline topic included until more contest reviews are available.');
    });
  }

  return [...topicMap.values()];
}

function scoreTopic(topic, { currentRating, targetRating }) {
  const weakness = 100 - clamp(topic.mastery);
  const mistakePressure = Math.min(24, topic.reviewHits * 10 + topic.reflectionHits * 8);
  const recommendationPressure = Math.min(18, topic.recommendationHits * 9);
  const targetPressure = topic.requiredForTarget ? 18 : 0;
  const ratingGap = Math.max(0, Number(targetRating || 1600) - Number(currentRating || 1200));
  const ratingPressure = Math.min(12, ratingGap / 50);
  const practiceNeglect = topic.attempts < 6 ? 8 : topic.attempts < 15 ? 4 : 0;
  return clamp(Math.round(weakness * 0.48 + mistakePressure + recommendationPressure + targetPressure + ratingPressure + practiceNeglect));
}

function confidenceForTopic(topic) {
  const samples = topic.confidenceSamples.length ? topic.confidenceSamples : [0.62];
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const evidenceBoost = Math.min(0.18, (topic.reviewHits + topic.reflectionHits + topic.recommendationHits + topic.attempts / 12) * 0.03);
  return normalizeConfidence(average + evidenceBoost);
}

function topicPriorityCards(inputs, context) {
  return inputs
    .map((topic) => {
      const roi = scoreTopic(topic, context);
      const confidence = confidenceForTopic(topic);
      const estimatedHours = Math.max(2, Math.round((100 - topic.mastery) / 12 + roi / 18));
      return {
        ...topic,
        roi,
        confidence,
        estimatedHours,
        importance: topic.requiredForTarget ? 'target-critical' : roi >= 80 ? 'high' : roi >= 62 ? 'medium' : 'maintenance',
        trend: topic.reviewHits || topic.reflectionHits ? 'needs attention' : topic.mastery >= 70 ? 'stable' : 'building',
        reason: topic.reasons.slice(0, 4)
      };
    })
    .sort((a, b) => b.roi - a.roi || a.topic.localeCompare(b.topic));
}

function recommendedProblems(recommendations, priorities) {
  const source = list(recommendations);
  const synthesized = priorities.slice(0, 6).map((topic, index) => ({
    id: `topic-practice-${topic.topic}-${index}`,
    title: `${topic.topic} focused practice`,
    recommendation: `Solve ${index < 2 ? '2' : '1'} ${topic.topic} problems at your current difficulty band.`,
    platform: 'Any connected platform',
    topic: topic.topic,
    difficulty: topic.roi >= 86 ? 'rating-targeted' : 'moderate',
    reason: topic.reason[0],
    estimatedTime: `${Math.max(30, topic.estimatedHours * 20)} minutes`,
    confidence: topic.confidence,
    priority: index < 2 ? 'high' : 'medium',
    evidence: topic.reason
  }));
  return [...source, ...synthesized].slice(0, 9).map((item, index) => ({
    id: item.id || item.recommendationId || `recommendation-${index}`,
    title: item.title || item.recommendation || `${titleCase(item.topic)} practice`,
    recommendation: item.recommendation || item.description,
    description: item.description || item.reason || item.nextAction || 'Practice item selected from existing recommendations and analytics.',
    platform: item.platform || 'Any connected platform',
    topic: titleCase(item.topic || topicFromRecommendation(item)),
    difficulty: item.difficulty || 'moderate',
    estimatedTime: item.estimatedTime || item.estimated_time || '45 minutes',
    confidence: normalizeConfidence(item.confidence || item.expectedImpact),
    priority: item.priority || (index < 3 ? 'high' : 'medium'),
    evidence: list(item.evidence).length ? list(item.evidence) : list(item.reason)
  }));
}

function normalizePlatform(platform) {
  const text = String(platform || '').toLowerCase();
  if (text.includes('codeforces')) return 'Codeforces';
  if (text.includes('leetcode')) return 'LeetCode';
  if (text.includes('codechef')) return 'CodeChef';
  return 'Codeforces';
}

function normalizeDifficulty(difficulty, topic = {}) {
  const text = String(difficulty || '').toLowerCase();
  if (text.includes('easy') || text.includes('foundation')) return 'Easy';
  if (text.includes('hard') || text.includes('stretch') || text.includes('target')) return 'Hard';
  if (Number(topic.roi) >= 86) return 'Hard';
  return 'Medium';
}

function practiceUrl(platform, topic, name) {
  return buildTopicPracticeUrl(platform, topic || name);
}

function collectSubmissions(analytics = {}) {
  return [
    ...list(analytics.recentSubmissions),
    ...list(analytics.submissions),
    ...list(analytics.contestHistory).flatMap((contest) => list(contest.submissions))
  ];
}

function statusForProblem(problem, analytics = {}) {
  const submissions = collectSubmissions(analytics);
  const topic = String(problem.topic || '').toLowerCase();
  const name = String(problem.name || problem.title || '').toLowerCase();
  const platform = String(problem.platform || '').toLowerCase();
  const matches = submissions.filter((submission) => {
    const submissionPlatform = String(submission.platform || submission.site || '').toLowerCase();
    const submissionProblem = String(submission.problemName || submission.problem || submission.name || submission.title || '').toLowerCase();
    const submissionTags = list(submission.tags || submission.topics).join(' ').toLowerCase();
    const platformMatches = !platform || !submissionPlatform || submissionPlatform.includes(platform);
    return platformMatches && (
      (name && submissionProblem && (submissionProblem.includes(name) || name.includes(submissionProblem))) ||
      (topic && (submissionProblem.includes(topic) || submissionTags.includes(topic)))
    );
  });

  if (!matches.length) return 'Not Attempted';
  const solved = matches.some((submission) => {
    const verdict = String(submission.verdict || submission.status || '').toLowerCase();
    return verdict.includes('accepted') || verdict === 'ok' || verdict === 'ac' || verdict.includes('solved');
  });
  return solved ? 'Solved' : 'Attempted';
}

function problemFromRecommendation(recommendation, source, analytics, index) {
  const platform = normalizePlatform(recommendation.platform);
  const topic = titleCase(recommendation.topic || source.topic || source.label);
  const name = recommendation.problemName || recommendation.name || recommendation.title || `${topic} practice set`;
  const problem = {
    id: `${source.id}-${platform}-${index}`,
    platform,
    name,
    difficulty: normalizeDifficulty(recommendation.difficulty, source),
    acceptanceRate: recommendation.acceptanceRate || recommendation.acceptance_rate || null,
    estimatedSolveTime: recommendation.estimatedSolveTime || recommendation.estimatedTime || source.estimatedTime || '45 minutes',
    topic,
    status: recommendation.status || 'Not Attempted',
    url: recommendation.url || recommendation.problemUrl || practiceUrl(platform, topic, name),
    requiredConcepts: list(recommendation.requiredConcepts).length ? list(recommendation.requiredConcepts) : [topic, 'Implementation discipline'],
    previousAttempts: Number(recommendation.previousAttempts || 0)
  };
  return { ...problem, status: statusForProblem(problem, analytics) };
}

function fallbackProblems(source, analytics = {}) {
  const topic = titleCase(source.topic || source.label);
  const difficulty = normalizeDifficulty(source.difficulty, source);
  return ['Codeforces', 'LeetCode'].map((platform, index) => {
    const problem = {
      id: `${source.id}-${platform}-${index}`,
      platform,
      name: `${topic} ${platform} practice`,
      difficulty,
      acceptanceRate: null,
      estimatedSolveTime: source.estimatedTime || '45 minutes',
      topic,
      status: 'Not Attempted',
      url: practiceUrl(platform, topic),
      requiredConcepts: [topic, difficulty === 'Hard' ? 'Edge-case handling' : 'Core pattern recognition'],
      previousAttempts: 0
    };
    return { ...problem, status: statusForProblem(problem, analytics) };
  });
}

export function buildProblemBank({ source = {}, planner = {}, analytics = {} } = {}) {
  const normalizedSource = {
    id: source.id || `${source.type || 'study'}-${titleCase(source.topic || source.label)}`,
    type: source.type || 'study-item',
    label: source.label || source.title || source.topic || 'Study Item',
    topic: titleCase(source.topic || source.label || source.title || 'Implementation'),
    difficulty: source.difficulty || 'moderate',
    estimatedTime: source.estimatedTime || source.duration || '45 minutes',
    confidence: normalizeConfidence(source.confidence || 0.68),
    reason: list(source.reason).length ? list(source.reason) : list(source.evidence)
  };

  const recommendations = [
    ...list(planner.recommendedProblems?.today),
    ...list(planner.recommendedProblems?.week),
    ...list(planner.recommendedProblems?.stretch)
  ].filter((recommendation) => titleCase(recommendation.topic) === normalizedSource.topic);

  const problems = recommendations.length
    ? recommendations.flatMap((recommendation, index) => {
      const platform = String(recommendation.platform || '').toLowerCase();
      if (!platform || platform.includes('any connected')) {
        return ['Codeforces', 'LeetCode'].map((targetPlatform, platformIndex) => problemFromRecommendation(
          { ...recommendation, platform: targetPlatform },
          normalizedSource,
          analytics,
          `${index}-${platformIndex}`
        ));
      }
      return problemFromRecommendation(recommendation, normalizedSource, analytics, index);
    })
    : fallbackProblems(normalizedSource, analytics);

  const grouped = problems.reduce((accumulator, problem) => {
    accumulator[problem.platform] = accumulator[problem.platform] || [];
    accumulator[problem.platform].push(problem);
    return accumulator;
  }, {});

  const difficultyDistribution = problems.reduce((accumulator, problem) => {
    accumulator[problem.difficulty] = (accumulator[problem.difficulty] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ...normalizedSource,
    problems,
    grouped,
    difficultyDistribution,
    progress: Math.round((problems.filter((problem) => problem.status === 'Solved').length / Math.max(1, problems.length)) * 100),
    updatedAt: new Date().toISOString()
  };
}

export function refreshProblemBankStatuses(problemBank, analytics = {}) {
  if (!problemBank) return problemBank;
  const problems = list(problemBank.problems).map((problem) => ({ ...problem, status: statusForProblem(problem, analytics) }));
  return {
    ...problemBank,
    problems,
    grouped: problems.reduce((accumulator, problem) => {
      accumulator[problem.platform] = accumulator[problem.platform] || [];
      accumulator[problem.platform].push(problem);
      return accumulator;
    }, {}),
    progress: Math.round((problems.filter((problem) => problem.status === 'Solved').length / Math.max(1, problems.length)) * 100),
    updatedAt: new Date().toISOString()
  };
}

function buildDailyPlan(priorities, recommendations) {
  const primary = priorities[0] || { topic: 'Implementation', roi: 72, confidence: 0.66 };
  const secondary = priorities[1] || primary;
  return [
    { title: 'Warm-up recognition', duration: '20 min', difficulty: 'easy', priority: 'medium', status: 'ready', topic: secondary.topic },
    { title: `${primary.topic} topic practice`, duration: '60 min', difficulty: primary.roi >= 85 ? 'targeted' : 'moderate', priority: 'high', status: 'ready', topic: primary.topic },
    { title: 'Implementation accuracy block', duration: '35 min', difficulty: 'moderate', priority: 'high', status: 'ready', topic: 'Implementation' },
    { title: 'Review one failed pattern', duration: '25 min', difficulty: 'reflection', priority: 'medium', status: 'ready', topic: primary.topic },
    { title: recommendations.length ? 'Quick start recommended problem' : 'Mock contest checkpoint', duration: recommendations.length ? recommendations[0].estimatedTime : '45 min', difficulty: 'mixed', priority: 'medium', status: 'ready', topic: recommendations[0]?.topic || primary.topic }
  ];
}

function buildWeeklyRoadmap(priorities) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days.map((day, index) => {
    const topic = priorities[index % Math.max(1, Math.min(priorities.length, 4))] || { topic: 'Implementation', roi: 70, confidence: 0.62 };
    return {
      day,
      focusTopic: topic.topic,
      targetProblems: index === 5 ? 4 : index === 6 ? 1 : 2,
      estimatedTime: index === 5 ? '150 min' : index === 6 ? '45 min' : '90 min',
      goal: index === 6 ? 'Review and consolidate the week' : `Improve ${topic.topic} mastery`,
      completion: 0,
      confidence: topic.confidence
    };
  });
}

function buildMilestones(priorities, targetRating) {
  return priorities.slice(0, 5).map((topic, index) => ({
    title: topic.topic,
    status: topic.mastery >= 75 ? 'complete' : index === 0 ? 'active' : 'planned',
    progress: clamp(topic.mastery),
    estimatedHours: topic.estimatedHours,
    recommendedProblems: Math.max(2, Math.round(topic.estimatedHours / 2)),
    confidence: topic.confidence,
    reason: topic.reason[0]
  })).concat({
    title: `Target Rating ${targetRating || 1600}`,
    status: 'target',
    progress: 0,
    estimatedHours: priorities.slice(0, 5).reduce((sum, topic) => sum + topic.estimatedHours, 0),
    recommendedProblems: priorities.slice(0, 5).reduce((sum, topic) => sum + Math.max(2, Math.round(topic.estimatedHours / 2)), 0),
    confidence: priorities.length ? priorities.reduce((sum, topic) => sum + topic.confidence, 0) / priorities.length : 0.62,
    reason: 'Milestone sequence is based on current gaps, review evidence, and selected target rating.'
  });
}

export function buildStudyPlanner({ contextualInsights = {}, analytics = {}, latestReview = {}, behaviorProfile = {}, behaviorFeatures = [], reflections = [], targetRating } = {}) {
  const currentRating = contextualInsights.currentRating || analytics.currentRating || analytics.ratingProgression?.at?.(-1)?.rating || 1200;
  const target = targetRating || contextualInsights.targetRating || Math.max(1400, Math.ceil((Number(currentRating) + 200) / 100) * 100);
  const review = latestReviewPayload(latestReview);
  const inputs = buildTopicInputs({ analytics, latestReview, reflections, targetRating: target });
  const priorities = topicPriorityCards(inputs, { currentRating, targetRating: target });
  const recommendations = recommendedProblems([
    ...list(contextualInsights.todaysRecommendations),
    ...review.recommendations
  ], priorities);
  const dailyPlan = buildDailyPlan(priorities, recommendations);
  const weeklyRoadmap = buildWeeklyRoadmap(priorities);
  const milestones = buildMilestones(priorities, target);
  const totalTodayMinutes = dailyPlan.reduce((sum, task) => sum + (Number.parseInt(task.duration, 10) || 0), 0);
  const weeklyMinutes = weeklyRoadmap.reduce((sum, day) => sum + (Number.parseInt(day.estimatedTime, 10) || 0), 0);
  const strongest = list(contextualInsights.strongestTopics).map((topic) => titleCase(topic.name || topic.topic || topic)).slice(0, 3);
  const weakest = priorities.slice(0, 3).map((topic) => topic.topic);
  const primary = priorities[0];

  return {
    status: priorities.length ? 'completed' : 'no-history',
    generatedAt: new Date().toISOString(),
    sourceSummary: {
      analyticsLoaded: Boolean(analytics.topicStrength || analytics.ratingProgression),
      latestReviewLoaded: Boolean(latestReview?.id || latestReview?.review_id || review.recommendations.length),
      reflectionCount: list(reflections).length + review.reflections.length,
      behaviorFeatureCount: list(behaviorFeatures).length,
      behaviorProfileLoaded: Boolean(behaviorProfile?.id || behaviorProfile?.profile)
    },
    todaysFocus: {
      goal: primary ? `Practice ${primary.topic} with implementation discipline` : contextualInsights.currentGoal,
      primaryWeakTopic: primary?.topic || 'Implementation',
      estimatedCompletionTime: `${Math.round(totalTodayMinutes / 5) * 5} min`,
      confidence: primary?.confidence || 0.62,
      why: primary?.reason || ['Selected from current analytics, review recommendations, and target rating requirements.']
    },
    dailyPlan,
    weeklyRoadmap,
    topicPriorities: priorities,
    recommendedProblems: {
      today: recommendations.slice(0, 3),
      week: recommendations.slice(3, 6),
      stretch: recommendations.slice(6, 9)
    },
    estimatedStudyTime: {
      todayMinutes: totalTodayMinutes,
      weekMinutes: weeklyMinutes,
      perTopic: priorities.slice(0, 5).map((topic) => ({ topic: topic.topic, hours: topic.estimatedHours })),
      perDifficulty: [
        { difficulty: 'foundation', minutes: Math.round(weeklyMinutes * 0.24) },
        { difficulty: 'targeted', minutes: Math.round(weeklyMinutes * 0.56) },
        { difficulty: 'stretch', minutes: Math.round(weeklyMinutes * 0.2) }
      ]
    },
    progress: {
      dailyCompletion: 0,
      weeklyCompletion: 0,
      topicMastery: priorities.length ? Math.round(priorities.reduce((sum, topic) => sum + topic.mastery, 0) / priorities.length) : 0,
      consistency: analytics.streak || 0,
      hoursStudied: 0,
      problemsSolved: analytics.solvedLastMonth || 0,
      contestPreparedness: clamp(Math.round((analytics.cpInsightScore || 45) * 0.55 + (primary?.confidence || 0.62) * 45))
    },
    targetRating: {
      currentRating,
      targetRating: target,
      estimatedSkillGap: Math.max(0, Number(target) - Number(currentRating)),
      requiredTopics: requiredTopicsForTarget(target),
      milestones,
      insights: {
        currentStrengths: strongest.length ? strongest : list(contextualInsights.strongestTopics).slice(0, 3),
        biggestGaps: weakest,
        highestRoiTopic: primary?.topic || 'Implementation',
        expectedWeeklyFocus: `${Math.round(weeklyMinutes / 60)} hours`,
        primaryBottleneck: primary?.topic ? `${primary.topic} execution gap` : 'Insufficient evidence'
      }
    },
    recentContestImpact: {
      title: review.title,
      generatedAt: review.generatedAt,
      confidence: review.confidence,
      recommendationsAdded: review.recommendations.length,
      reflectionsAdded: review.reflections.length,
      summary: review.recommendations[0]?.recommendation || review.recommendations[0]?.description || 'Latest review data will adjust this planner automatically when available.'
    }
  };
}
