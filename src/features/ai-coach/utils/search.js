function includes(value, query) {
  return String(value || '').toLowerCase().includes(query);
}

export function searchWorkspace({ sessions = [], reflections = [], recommendations = [], evidence = [], query = '' }) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return { sessions, reflections, recommendations, evidence };
  }
  return {
    sessions: sessions.filter((session) => includes(session.title, normalized) || includes(session.summary, normalized)),
    reflections: reflections.filter((reflection) => includes(reflection.behaviorFinding, normalized) || includes(reflection.type, normalized)),
    recommendations: recommendations.filter((recommendation) => includes(recommendation.title || recommendation.recommendation, normalized)),
    evidence: evidence.filter((item) => includes(item.finding || item.title, normalized) || includes(item.type, normalized))
  };
}
