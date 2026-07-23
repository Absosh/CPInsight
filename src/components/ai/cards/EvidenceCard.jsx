import React from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { StateShell } from '../base/StateShell.jsx';
import { safeList } from '../base/componentUtils.js';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';
import { useAiInteractions } from '../providers/AiInteractionProvider.jsx';

export function EvidenceCard({ evidence, state = 'success' }) {
  const { onInspectEvidence, onOpenTimeline } = useAiInteractions();
  if (!evidence) {
    return <StateShell state="empty" title="No evidence" message="No supporting evidence is available." />;
  }
  return (
    <StateShell state={state}>
      <article className="ai-card ai-evidence-card ai-reveal" data-interactive="true">
        <header className="ai-card-header">
          <AiIcon name="evidence" label="Evidence" />
          <div>
            <h3>{evidence.finding || evidence.title || 'Evidence'}</h3>
            <p>{evidence.type || evidence.evidenceType || 'Evidence reference'}</p>
          </div>
          <ConfidenceBadge value={evidence.confidence} />
        </header>
        {evidence.supportingData ? <p className="ai-muted">{evidence.supportingData}</p> : null}
        <dl className="ai-meta-grid">
          {evidence.contest ? <><dt>Contest</dt><dd>{evidence.contest}</dd></> : null}
          {evidence.source ? <><dt>Source</dt><dd>{evidence.source}</dd></> : null}
        </dl>
        <details>
          <summary>Inspect citations</summary>
          <ul>
            {safeList(evidence.citations || evidence.evidenceIds).map((citation) => <li key={citation}>{citation}</li>)}
          </ul>
        </details>
        <footer className="ai-card-actions">
          <button className="ai-button ai-focusable" type="button" onClick={() => onInspectEvidence(evidence)}>Inspect</button>
          <button className="ai-icon-button ai-focusable" type="button" aria-label="Open timeline" onClick={() => onOpenTimeline(evidence)}>
            <AiIcon name="time" label="Timeline" />
          </button>
        </footer>
      </article>
    </StateShell>
  );
}
