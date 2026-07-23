import React from 'react';
import { ReflectionTimeline } from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

export function ReflectionWorkspace() {
  const { state } = useAiCoachWorkspace();
  return (
    <section className="coach-workspace-surface">
      <header>
        <h2>Reflection Timeline</h2>
        <p>Validated reflections filtered by behavior, contest, topic, date, and confidence.</p>
      </header>
      <ReflectionTimeline reflections={state.contextualInsights.recentReflections} filters={['all', 'contest', 'topic', 'behavior', 'strength', 'weakness', 'pattern']} />
    </section>
  );
}
