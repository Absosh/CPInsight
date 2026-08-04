import React, { useMemo } from 'react';
import { ConversationView } from '../../../components/ai/index.js';
import { useVirtualMessages } from '../hooks/useVirtualMessages.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { selectActiveSession } from '../state/selectors.js';
import { CoachMessageRenderer } from './CoachMessageRenderer.jsx';
import { MessageComposer } from './MessageComposer.jsx';
import { ReflectionWorkspace } from './ReflectionWorkspace.jsx';
import { RoadmapWorkspace } from './RoadmapWorkspace.jsx';
import { StudyPlannerWorkspace } from './StudyPlannerWorkspace.jsx';

const suggestedPrompts = [
  'Analyze my last contest',
  "Build today's study plan",
  'Review my weakest topic',
  'Show my improvement'
];

function PrimaryTabs({ activeView, onChange }) {
  const tabs = [
    ['conversation', 'Chat'],
    ['studyPlans', 'Study Planner']
  ];
  return (
    <div className="coach-primary-tabs" role="tablist" aria-label="AI Assistant sections">
      {tabs.map(([view, label]) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={activeView === view}
          onClick={() => onChange(view)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function CenterPanel() {
  const { state, dispatch, submitQuestion } = useAiCoachWorkspace();
  const session = selectActiveSession(state);
  const messages = useVirtualMessages(session?.messages || []);
  const content = useMemo(() => {
    if (state.activeView === 'reflections') return <ReflectionWorkspace />;
    if (state.activeView === 'studyPlans') return <StudyPlannerWorkspace />;
    if (state.activeView === 'contestReviews' || state.activeView === 'savedReports' || state.activeView === 'settings') return <RoadmapWorkspace />;
    return (
      <ConversationView composer={<MessageComposer />}>
        {messages.length ? messages.map((message) => <CoachMessageRenderer key={message.messageId} message={message} />) : (
          <section className="coach-empty-state">
            <div className="coach-empty-orb" aria-hidden="true">AI</div>
            <p className="coach-empty-kicker">Evidence-first coaching</p>
            <h2>Start with a question that needs evidence.</h2>
            <p>Ask CPInsight to explain contests, surface behavior patterns, or turn validated recommendations into a focused practice plan.</p>
            <div className="coach-suggestion-grid" aria-label="Suggested prompts">
              {suggestedPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => submitQuestion(prompt)}>{prompt}</button>)}
            </div>
          </section>
        )}
      </ConversationView>
    );
  }, [messages, state.activeView, submitQuestion]);
  return (
    <main className="coach-center-panel">
      <PrimaryTabs activeView={state.activeView === 'studyPlans' ? 'studyPlans' : 'conversation'} onChange={(view) => dispatch({ type: 'workspace/viewChanged', view })} />
      {content}
    </main>
  );
}
