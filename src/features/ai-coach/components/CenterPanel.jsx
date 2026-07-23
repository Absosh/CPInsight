import React, { useMemo } from 'react';
import { ConversationView } from '../../../components/ai/index.js';
import { useVirtualMessages } from '../hooks/useVirtualMessages.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { selectActiveSession } from '../state/selectors.js';
import { CoachMessageRenderer } from './CoachMessageRenderer.jsx';
import { MessageComposer } from './MessageComposer.jsx';
import { ReflectionWorkspace } from './ReflectionWorkspace.jsx';
import { RoadmapWorkspace } from './RoadmapWorkspace.jsx';

export function CenterPanel() {
  const { state } = useAiCoachWorkspace();
  const session = selectActiveSession(state);
  const messages = useVirtualMessages(session?.messages || []);
  const content = useMemo(() => {
    if (state.activeView === 'reflections') return <ReflectionWorkspace />;
    if (state.activeView === 'studyPlans') return <RoadmapWorkspace />;
    return (
      <ConversationView composer={<MessageComposer />}>
        {messages.length ? messages.map((message) => <CoachMessageRenderer key={message.messageId} message={message} />) : (
          <section className="coach-empty-state">
            <h2>Start with a question that needs evidence.</h2>
            <p>Try asking why a contest went poorly, whether you are improving, or what to practice next.</p>
          </section>
        )}
      </ConversationView>
    );
  }, [messages, state.activeView]);
  return <main className="coach-center-panel">{content}</main>;
}
