import React from 'react';
import { AiIcon } from '../base/Icon.jsx';

export function ProgressMilestone({ currentStage, completed = 0, remaining = 0, estimatedCompletion }) {
  const total = Math.max(1, Number(completed) + Number(remaining));
  const progress = Math.round((Number(completed) / total) * 100);
  return (
    <section className="ai-card ai-progress-milestone" aria-label={`Progress ${progress}%`}>
      <header className="ai-card-header">
        <AiIcon name="progress" label="Progress" />
        <div>
          <h3>{currentStage || 'Current stage'}</h3>
          <p>{estimatedCompletion || 'Completion not estimated'}</p>
        </div>
      </header>
      <div className="ai-progress-track">
        <span style={{ inlineSize: `${progress}%` }} />
      </div>
      <dl className="ai-meta-grid">
        <dt>Completed</dt><dd>{completed}</dd>
        <dt>Remaining</dt><dd>{remaining}</dd>
      </dl>
    </section>
  );
}
