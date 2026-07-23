import React from 'react';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';

export function QualityIndicator({ quality = {}, status = 'validated' }) {
  const rows = [
    ['Grounding', quality.groundingCoverage],
    ['Evidence', quality.evidenceCoverage || quality.citationQuality],
    ['Quality', quality.overallQualityScore]
  ];
  return (
    <section className="ai-card ai-quality-indicator" aria-label={`Validation status ${status}`}>
      <header className="ai-card-header">
        <h3>Validation</h3>
        <span className="ai-status-pill" data-status={status}>{status}</span>
      </header>
      <div className="ai-quality-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <ConfidenceBadge value={value || 0} label={label} />
          </div>
        ))}
      </div>
    </section>
  );
}
