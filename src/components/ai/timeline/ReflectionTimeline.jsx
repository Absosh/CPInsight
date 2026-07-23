import React, { useMemo, useState } from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';
import { safeList } from '../base/componentUtils.js';

export function ReflectionTimeline({ reflections = [], filters = ['all', 'strength', 'weakness', 'pattern'] }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const visible = useMemo(() => safeList(reflections).filter((item) => activeFilter === 'all' || item.type === activeFilter), [reflections, activeFilter]);
  return (
    <section className="ai-card ai-reflection-timeline" aria-label="Reflection timeline">
      <header className="ai-card-header">
        <AiIcon name="reflection" label="Reflection" />
        <div>
          <h3>Reflection Timeline</h3>
          <p>Behavior evolution and validated milestones</p>
        </div>
      </header>
      <div className="ai-segmented-control" role="tablist" aria-label="Reflection filters">
        {filters.map((filter) => (
          <button key={filter} className="ai-focusable" type="button" role="tab" aria-selected={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
            {filter}
          </button>
        ))}
      </div>
      <ol className="ai-timeline-list">
        {visible.map((reflection) => (
          <li key={reflection.reflectionId || `${reflection.type}-${reflection.createdAt}`}>
            <span className="ai-timeline-marker" />
            <div>
              <time>{reflection.createdAt}</time>
              <h4>{reflection.behaviorFinding}</h4>
              <ConfidenceBadge value={reflection.confidence} />
              <details>
                <summary>Evidence</summary>
                <ul>{safeList(reflection.supportingEvidence).map((id) => <li key={id}>{id}</li>)}</ul>
              </details>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
