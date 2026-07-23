import React from 'react';
import { RoadmapViewer } from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

export function RoadmapWorkspace() {
  const { state } = useAiCoachWorkspace();
  return (
    <section className="coach-workspace-surface">
      <header>
        <h2>Study Plan</h2>
        <p>Goal-driven roadmap assembled from validated recommendations.</p>
      </header>
      <RoadmapViewer roadmap={{
        currentStage: state.contextualInsights.currentGoal,
        completed: 0,
        remaining: state.contextualInsights.todaysRecommendations.length,
        estimatedCompletion: 'Based on future saved study plan metadata',
        recommendations: state.contextualInsights.todaysRecommendations
      }} />
    </section>
  );
}
