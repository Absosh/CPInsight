import React from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { BehaviorChip } from './BehaviorChip.jsx';
import { safeList } from '../base/componentUtils.js';

function Section({ title, children, open = false }) {
  return (
    <details className="ai-reasoning-section" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function ReasoningPanel({ reasoning = {} }) {
  const chain = safeList(reasoning.reasoningChain || reasoning.causalChains);
  return (
    <aside className="ai-card ai-reasoning-panel" aria-label="Reasoning details">
      <header className="ai-card-header">
        <AiIcon name="insight" label="Insight" />
        <div>
          <h3>Reasoning</h3>
          <p>Findings, evidence, contradictions, and missing context</p>
        </div>
      </header>
      <Section title="Reasoning chain" open>
        <ol className="ai-chain">
          {chain.map((step, index) => <li key={`${step.label || step.conceptId || index}`}>{step.label || step.conceptId || step}</li>)}
        </ol>
      </Section>
      <Section title="Primary findings" open>
        <div className="ai-chip-row">
          {safeList(reasoning.primaryFindings).map((finding) => (
            <BehaviorChip key={finding.findingId || finding.conceptId} behavior={finding.label || finding.conceptId} kind={finding.findingType} confidence={finding.confidence} />
          ))}
        </div>
      </Section>
      <Section title="Secondary findings">
        <div className="ai-chip-row">
          {safeList(reasoning.secondaryFindings).map((finding) => (
            <BehaviorChip key={finding.findingId || finding.conceptId} behavior={finding.label || finding.conceptId} kind={finding.findingType} confidence={finding.confidence} />
          ))}
        </div>
      </Section>
      <Section title="Contradictions">
        <ul>{safeList(reasoning.contradictions).map((item, index) => <li key={item.id || index}>{item.summary || item.reason || String(item)}</li>)}</ul>
      </Section>
      <Section title="Missing evidence">
        <ul>{safeList(reasoning.missingEvidence).map((item, index) => <li key={item.id || index}>{item.summary || item.source || String(item)}</li>)}</ul>
      </Section>
    </aside>
  );
}
