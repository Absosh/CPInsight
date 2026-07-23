import React from 'react';
import {
  ActionPlan,
  CoachMessage,
  CoachResponse,
  EvidenceExplorer,
  QualityIndicator,
  ReasoningPanel,
  RecommendationList
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
    dispatch({ type: 'messages/exported', messageId: message.messageId, title: 'AI Coach response', payload: { content, sections: message.sections, metadata: message.metadata } });
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

function RecommendationActionRail({ recommendations = [] }) {
  const { dispatch } = useAiCoachWorkspace();
  function record(recommendation, action) {
    dispatch({
      type: 'recommendations/actionRecorded',
      recommendationId: recommendation.id || recommendation.title || recommendation.recommendation,
      action
    });
  }
  if (!recommendations.length) return null;
  return (
    <section className="coach-recommendation-actions" aria-label="Recommendation actions">
      {recommendations.map((recommendation) => (
        <div key={recommendation.id || recommendation.title || recommendation.recommendation}>
          <strong>{recommendation.title || recommendation.recommendation}</strong>
          <span>
            {['accept', 'dismiss', 'save', 'complete', 'remind_later'].map((action) => (
              <button key={action} type="button" onClick={() => record(recommendation, action)}>{action.replace(/_/g, ' ')}</button>
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

export function CoachMessageRenderer({ message, onRetry }) {
  if (message.role === 'user') return <UserMessage message={message} />;
  if (message.status === 'failed') return <FailedMessage message={message} onRetry={onRetry} />;
  if (message.status === 'streaming' || message.status === 'queued') {
    return <CoachMessage question="CPInsight Coach" response={message.content || 'Preparing evidence-backed response...'} timestamp={message.createdAt} streaming state="streaming" />;
  }
  const sections = message.sections || {};
  return (
    <article className="coach-rendered-response">
      <CoachResponse
        question="CPInsight Coach"
        response={sections.response || message.content}
        quality={sections.quality}
        reasoning={sections.reasoning}
        evidence={sections.evidence}
        recommendations={sections.recommendations}
        timestamp={message.createdAt}
      />
      <section className="coach-response-sections" aria-label="Response sections">
        <QualityIndicator quality={sections.quality} status="validated" />
        <ReasoningPanel reasoning={sections.reasoning} />
        <EvidenceExplorer evidence={sections.evidence} sources={sections.sources} />
        <RecommendationList recommendations={sections.recommendations} />
        <RecommendationActionRail recommendations={sections.recommendations || []} />
        <ActionPlan plan={{ title: 'Action Items', completed: 0, remaining: sections.actionItems?.length || 0, actions: sections.actionItems }} />
      </section>
      <MessageActions message={message} />
    </article>
  );
}
