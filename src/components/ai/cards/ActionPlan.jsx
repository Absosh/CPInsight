import React from 'react';
import { RecommendationList } from './RecommendationList.jsx';
import { ProgressMilestone } from '../timeline/ProgressMilestone.jsx';

export function ActionPlan({ plan = {} }) {
  return (
    <section className="ai-action-plan">
      <ProgressMilestone currentStage={plan.title || 'Action Plan'} completed={plan.completed || 0} remaining={plan.remaining || 0} estimatedCompletion={plan.estimatedCompletion} />
      <RecommendationList recommendations={plan.actions || []} />
    </section>
  );
}
