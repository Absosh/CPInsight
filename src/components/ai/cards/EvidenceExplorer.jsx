import React, { useMemo, useState } from 'react';
import { EvidenceCard } from './EvidenceCard.jsx';
import { SourceReference } from './SourceReference.jsx';
import { safeList } from '../base/componentUtils.js';

export function EvidenceExplorer({ evidence = [], sources = [] }) {
  const [activeType, setActiveType] = useState('all');
  const types = useMemo(() => ['all', ...new Set(safeList(evidence).map((item) => item.type || 'evidence'))], [evidence]);
  const visible = safeList(evidence).filter((item) => activeType === 'all' || (item.type || 'evidence') === activeType);
  return (
    <section className="ai-evidence-explorer">
      <div className="ai-segmented-control" role="tablist" aria-label="Evidence filters">
        {types.map((type) => <button key={type} className="ai-focusable" type="button" role="tab" aria-selected={activeType === type} onClick={() => setActiveType(type)}>{type}</button>)}
      </div>
      <div className="ai-source-row">{safeList(sources).map((source) => <SourceReference key={source.id || source.label} source={source} />)}</div>
      <div className="ai-card-grid">{visible.map((item) => <EvidenceCard key={item.evidenceId || item.id} evidence={item} />)}</div>
    </section>
  );
}
