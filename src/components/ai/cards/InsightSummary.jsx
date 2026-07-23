import React from 'react';
import { BehaviorChip } from '../reasoning/BehaviorChip.jsx';
import { QualityIndicator } from '../feedback/QualityIndicator.jsx';
import { safeList } from '../base/componentUtils.js';

export function InsightSummary({ insights = [], quality }) {
  return (
    <section className="ai-card ai-insight-summary">
      <header className="ai-card-header">
        <h3>Insight Summary</h3>
        <QualityIndicator quality={quality} status="validated" />
      </header>
      <div className="ai-chip-row">
        {safeList(insights).map((insight) => <BehaviorChip key={insight.id || insight.label} behavior={insight.label} kind={insight.kind} trend={insight.trend} confidence={insight.confidence} />)}
      </div>
    </section>
  );
}
