import React from 'react';
import { BehaviorChip } from './BehaviorChip.jsx';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';
import { safeList } from '../base/componentUtils.js';

export function BehaviorOverview({ profile = {} }) {
  return (
    <section className="ai-card ai-behavior-overview">
      <header className="ai-card-header">
        <div>
          <h3>Behavior Overview</h3>
          <p>{profile.window || 'Current behavior profile'}</p>
        </div>
        <ConfidenceBadge value={profile.confidence || 0} />
      </header>
      <div className="ai-chip-row">
        {safeList(profile.behaviors).map((behavior) => (
          <BehaviorChip key={behavior.name} behavior={behavior.name} kind={behavior.kind} trend={behavior.trend} confidence={behavior.confidence} />
        ))}
      </div>
    </section>
  );
}
