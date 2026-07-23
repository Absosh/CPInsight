import React from 'react';
import { ProgressMilestone } from '../timeline/ProgressMilestone.jsx';
import { RecommendationList } from './RecommendationList.jsx';

export function RoadmapViewer({ roadmap = {} }) {
  return (
    <section className="ai-roadmap-viewer">
      <ProgressMilestone currentStage={roadmap.currentStage} completed={roadmap.completed} remaining={roadmap.remaining} estimatedCompletion={roadmap.estimatedCompletion} />
      <RecommendationList recommendations={roadmap.recommendations || []} />
    </section>
  );
}
