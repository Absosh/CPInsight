import React from 'react';
import {
  ActionPlan,
  AiWorkspace,
  BehaviorChip,
  BehaviorOverview,
  CardGrid,
  CoachMessage,
  CoachResponse,
  ConfidenceBadge,
  ConfidenceScale,
  ContestReview,
  ConversationView,
  EvidenceCard,
  EvidenceExplorer,
  InsightSummary,
  ProgressMilestone,
  QualityIndicator,
  ReasoningPanel,
  RecommendationCard,
  RecommendationList,
  ReflectionFeed,
  ReflectionTimeline,
  RoadmapViewer,
  SourceReference,
  SplitView
} from '../index.js';

const evidence = [
  { evidenceId: 'ev-1', finding: 'Late contest panic', type: 'behavior_insight', confidence: 0.86, contest: 'Codeforces Round', source: 'Knowledge Graph', supportingData: 'Repeated incorrect submissions in final 20 minutes.', citations: ['ev-1'] },
  { evidenceId: 'ev-2', finding: 'Recovery strength', type: 'behavior_feature', confidence: 0.78, contest: 'CodeChef Starters', source: 'Behavior Profile', supportingData: 'Recovered after failed first attempt.', citations: ['ev-2'] }
];

const recommendations = [
  { id: 'r-1', title: 'Run timed virtual contests', priority: 'high', confidence: 0.82, difficulty: 'moderate', estimatedTime: '3 sessions', progress: 30, evidence: ['ev-1'] },
  { id: 'r-2', title: 'Practice fallback strategies', priority: 'medium', confidence: 0.74, difficulty: 'easy', estimatedTime: '45 minutes', progress: 10, evidence: ['ev-2'] }
];

const reasoning = {
  primaryFindings: [{ findingId: 'f-1', conceptId: 'panic', findingType: 'weakness', confidence: 0.86 }],
  secondaryFindings: [{ findingId: 'f-2', conceptId: 'recovery_strategy', findingType: 'strength', confidence: 0.78 }],
  causalChains: [{ label: 'Poor time allocation' }, { label: 'Late pressure' }, { label: 'Incorrect submissions' }],
  contradictions: [{ id: 'c-1', summary: 'Strong recovery appears in easier contests.' }],
  missingEvidence: [{ id: 'm-1', summary: 'Need more rated contest samples.' }]
};

const reflections = [
  { reflectionId: 'rf-1', type: 'weakness', behaviorFinding: 'Late contest panic', confidence: 0.84, createdAt: '2026-07-23', supportingEvidence: ['ev-1'] },
  { reflectionId: 'rf-2', type: 'strength', behaviorFinding: 'Recovery after failed attempt', confidence: 0.78, createdAt: '2026-07-22', supportingEvidence: ['ev-2'] }
];

export default {
  title: 'AI Design System/Components',
  parameters: { layout: 'fullscreen' }
};

export const CoachMessageDefault = () => <CoachMessage question="Why did my rating drop?" response="The strongest supported explanation is late-contest pressure, backed by repeated final-window mistakes." timestamp="2026-07-23" metadata={{ validationId: 'val-1' }} />;
export const CoachMessageStreaming = () => <CoachMessage question="What should I practice?" response="Prioritize timed strategy drills" timestamp="Now" streaming state="streaming" />;
export const EvidenceCardDefault = () => <EvidenceCard evidence={evidence[0]} />;
export const ReasoningPanelDefault = () => <ReasoningPanel reasoning={reasoning} />;
export const ConfidenceBadgeDefault = () => <ConfidenceBadge value={0.86} animated />;
export const ConfidenceScaleDefault = () => <ConfidenceScale value={0.72} />;
export const RecommendationCardDefault = () => <RecommendationCard recommendation={recommendations[0]} />;
export const BehaviorChipDefault = () => <BehaviorChip behavior="Persistence" kind="strength" trend="improving" confidence={0.82} />;
export const ReflectionTimelineDefault = () => <ReflectionTimeline reflections={reflections} />;
export const ProgressMilestoneDefault = () => <ProgressMilestone currentStage="Pressure management" completed={3} remaining={5} estimatedCompletion="2 weeks" />;
export const SourceReferenceDefault = () => <SourceReference source={{ label: 'Behavior Profile', type: 'profile', confidence: 0.81 }} />;
export const QualityIndicatorDefault = () => <QualityIndicator quality={{ groundingCoverage: 1, citationQuality: 0.92, overallQualityScore: 0.89 }} />;
export const CoachResponseComposite = () => <CoachResponse question="Why did I panic late?" response={{ summary: 'Late pressure is supported by evidence from repeated final-window errors.' }} quality={{ groundingCoverage: 1, citationQuality: 1, overallQualityScore: 0.91 }} reasoning={reasoning} evidence={evidence} recommendations={recommendations} timestamp="2026-07-23" />;
export const EvidenceExplorerComposite = () => <EvidenceExplorer evidence={evidence} sources={[{ id: 's-1', label: 'Knowledge Graph', type: 'graph', confidence: 0.9 }]} />;
export const RecommendationListComposite = () => <RecommendationList recommendations={recommendations} />;
export const BehaviorOverviewComposite = () => <BehaviorOverview profile={{ confidence: 0.8, window: 'Last 30 days', behaviors: [{ name: 'Persistence', kind: 'strength', trend: 'stable', confidence: 0.84 }, { name: 'Decision delay', kind: 'weakness', trend: 'declining', confidence: 0.7 }] }} />;
export const ReflectionFeedComposite = () => <ReflectionFeed reflections={reflections} />;
export const RoadmapViewerComposite = () => <RoadmapViewer roadmap={{ currentStage: 'Stabilize contest decisions', completed: 2, remaining: 4, estimatedCompletion: '3 weeks', recommendations }} />;
export const ContestReviewComposite = () => <ContestReview review={{ title: 'Contest Review', summary: 'Validated behavior review', reasoning, evidence, recommendations }} />;
export const InsightSummaryComposite = () => <InsightSummary insights={[{ id: 'i-1', label: 'Recovery', kind: 'strength', confidence: 0.78 }]} quality={{ groundingCoverage: 1, citationQuality: 1, overallQualityScore: 0.88 }} />;
export const ActionPlanComposite = () => <ActionPlan plan={{ title: 'Next actions', completed: 1, remaining: 3, estimatedCompletion: '10 days', actions: recommendations }} />;
export const LayoutWorkspace = () => <AiWorkspace sidebar={<BehaviorOverviewComposite />} main={<ConversationView><CoachResponseComposite /></ConversationView>} dock={<ReasoningPanelDefault />} />;
export const LayoutSplitAndGrid = () => <SplitView primary={<CardGrid><EvidenceCardDefault /><RecommendationCardDefault /></CardGrid>} secondary={<QualityIndicatorDefault />} />;
