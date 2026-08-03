import React from 'react';
import { AiIcon } from './Icon.jsx';
import { MarkdownText } from './MarkdownText.jsx';
import { StateShell } from './StateShell.jsx';

export function CoachMessage({ question, response, timestamp, metadata, streaming = false, state = 'success' }) {
  const hasMetadata = metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0;
  return (
    <StateShell state={state}>
      <article className="ai-card ai-coach-message ai-reveal" aria-live={streaming ? 'polite' : 'off'}>
        <header className="ai-card-header">
          <AiIcon name="insight" label="AI coach" />
          <div>
            <h3>{question || 'AI Coach'}</h3>
            <p>{timestamp || 'No timestamp'}</p>
          </div>
        </header>
        <div className={streaming ? 'ai-streaming-cursor' : undefined}>
          <MarkdownText value={response || 'No response available.'} />
        </div>
        {hasMetadata && (
          <details>
            <summary>Metadata</summary>
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
          </details>
        )}
      </article>
    </StateShell>
  );
}
