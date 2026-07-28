import React from 'react';
import { BehaviorOverview, ReflectionFeed, RecommendationList } from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

function Metric({ label, value }) {
  return (
    <div className="coach-context-metric">
      <i aria-hidden="true" />
      <span>{label}</span>
      <strong>{value ?? 'Not available'}</strong>
    </div>
  );
}

export function RightSidebar() {
  const { state } = useAiCoachWorkspace();
  const insights = state.contextualInsights;
  return (
    <aside className="coach-right-sidebar" aria-label="Contextual AI insights">
      <section className="coach-context-card">
        <h2><span aria-hidden="true">CX</span> Context</h2>
        <Metric label="Current Rating" value={insights.currentRating} />
        <Metric label="Target Rating" value={insights.targetRating} />
        <Metric label="Current Goal" value={insights.currentGoal} />
        <Metric label="Learning Velocity" value={insights.learningVelocity} />
      </section>
      <BehaviorOverview profile={{ confidence: 0.74, window: 'Behavior summary', behaviors: insights.behaviorSummary }} />
      <section className="coach-topic-grid">
        <h3>Weakest Topics</h3>
        <ul>{(insights.weakestTopics || []).map((topic) => <li key={topic.name || topic}>{topic.name || topic}</li>)}</ul>
        <h3>Strongest Topics</h3>
        <ul>{(insights.strongestTopics || []).map((topic) => <li key={topic.name || topic}>{topic.name || topic}</li>)}</ul>
      </section>
      <RecommendationList recommendations={insights.todaysRecommendations} />
      <ReflectionFeed reflections={insights.recentReflections} />
    </aside>
  );
}
