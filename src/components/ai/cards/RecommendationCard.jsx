import React from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';
import { safeList } from '../base/componentUtils.js';

export function RecommendationCard({ recommendation, onToggleComplete }) {
  const item = recommendation || {};
  return (
    <article className="ai-card ai-recommendation-card ai-reveal" data-priority={item.priority || 'medium'} data-interactive="true">
      <header className="ai-card-header">
        <AiIcon name="recommendation" label="Recommendation" />
        <div>
          <h3>{item.title || item.recommendation || 'Recommendation'}</h3>
          <p>{item.priority || 'medium'} priority</p>
        </div>
        <ConfidenceBadge value={item.confidence || item.expectedImpact || 0.6} label="Expected impact" />
      </header>
      <p>{item.description || item.nextAction || 'Action details are not available.'}</p>
      <dl className="ai-meta-grid">
        <dt>Difficulty</dt><dd>{item.difficulty || 'moderate'}</dd>
        <dt>Estimated time</dt><dd>{item.estimatedTime || 'not estimated'}</dd>
      </dl>
      <div className="ai-progress-track" aria-label={`Progress ${item.progress || 0}%`}>
        <span style={{ inlineSize: `${Math.max(0, Math.min(100, item.progress || 0))}%` }} />
      </div>
      <details>
        <summary>Evidence</summary>
        <ul>{safeList(item.evidence).map((evidenceId) => <li key={evidenceId}>{evidenceId}</li>)}</ul>
      </details>
      <footer className="ai-card-actions">
        <button className="ai-button ai-focusable" type="button" aria-pressed={Boolean(item.completed)} onClick={() => onToggleComplete?.(item)}>
          {item.completed ? 'Completed' : 'Mark complete'}
        </button>
      </footer>
    </article>
  );
}
