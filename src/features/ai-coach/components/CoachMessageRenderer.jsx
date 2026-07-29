import React from 'react';
import {
  CoachMessage,
} from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

function UserMessage({ message }) {
  return (
    <article className="coach-user-message">
      <p>{message.content}</p>
      <time>{message.createdAt}</time>
    </article>
  );
}

function FailedMessage({ message, onRetry }) {
  return (
    <article className="coach-failed-message" role="alert">
      <strong>Response failed</strong>
      <p>{message.error || 'The coach response could not be completed.'}</p>
      <button type="button" onClick={onRetry}>Retry</button>
    </article>
  );
}

function MessageActions({ message }) {
  const { dispatch, submitQuestion } = useAiCoachWorkspace();
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.sections || {}, null, 2);
  function copyResponse() {
    globalThis.navigator?.clipboard?.writeText(content);
    dispatch({ type: 'messages/copied', messageId: message.messageId });
  }
  function exportResponse() {
    dispatch({ type: 'messages/exported', messageId: message.messageId, title: 'AI Assistant response', payload: { content, sections: message.sections, metadata: message.metadata } });
  }
  function regenerate() {
    submitQuestion(message.metadata?.question || 'Regenerate the previous response with the same evidence requirements.');
  }
  return (
    <footer className="coach-message-actions" aria-label="Response actions">
      <button type="button" onClick={copyResponse}>Copy</button>
      <button type="button" onClick={exportResponse}>Export</button>
      <button type="button" onClick={regenerate}>Regenerate</button>
    </footer>
  );
}

export function CoachMessageRenderer({ message, onRetry }) {
  if (message.role === 'user') return <UserMessage message={message} />;
  if (message.status === 'failed') return <FailedMessage message={message} onRetry={onRetry} />;
  if (message.status === 'streaming' || message.status === 'queued') {
    return <CoachMessage question="CPInsight Coach" response={message.content || 'Preparing evidence-backed response...'} timestamp={message.createdAt} streaming state="streaming" />;
  }
  const sections = message.sections || {};
  const response = sections.response?.summary || sections.response || message.content;
  return (
    <article className="coach-rendered-response">
      <CoachMessage
        question="CPInsight Coach"
        response={response}
        timestamp={message.createdAt}
      />
      <MessageActions message={message} />
    </article>
  );
}
