import React from 'react';
import { AiCoachWorkspace } from '../index.js';
import { createInitialAiCoachState } from '../state/aiCoachReducer.js';

const initialState = {
  ...createInitialAiCoachState('2026-07-23T00:00:00.000Z'),
  contextualInsights: {
    currentRating: 1420,
    targetRating: 1600,
    currentGoal: 'Stabilize late-contest decisions',
    learningVelocity: 'improving',
    behaviorSummary: [
      { name: 'Persistence', kind: 'strength', trend: 'stable', confidence: 0.84 },
      { name: 'Decision delay', kind: 'weakness', trend: 'improving', confidence: 0.68 }
    ],
    recentReflections: [
      { reflectionId: 'rf-1', type: 'weakness', behaviorFinding: 'Late contest panic', confidence: 0.82, createdAt: '2026-07-22', supportingEvidence: ['ev-1'] }
    ],
    weakestTopics: [{ name: 'Dynamic Programming' }, { name: 'Graphs' }],
    strongestTopics: [{ name: 'Greedy' }, { name: 'Implementation' }],
    todaysRecommendations: [
      { id: 'rec-1', title: 'Run a 90-minute virtual contest', priority: 'high', confidence: 0.8, estimatedTime: '90 minutes', progress: 0, evidence: ['ev-1'] }
    ]
  }
};

export default {
  title: 'AI Coach/Workspace',
  component: AiCoachWorkspace,
  parameters: { layout: 'fullscreen' }
};

export const DefaultWorkspace = () => <AiCoachWorkspace initialState={initialState} />;
export const ReflectionTimeline = () => <AiCoachWorkspace initialState={{ ...initialState, activeView: 'reflections' }} />;
export const StudyPlan = () => <AiCoachWorkspace initialState={{ ...initialState, activeView: 'studyPlans' }} />;
