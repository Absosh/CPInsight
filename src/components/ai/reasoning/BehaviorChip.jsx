import React from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { confidenceCategory } from '../base/componentUtils.js';

export function BehaviorChip({ behavior, kind = 'neutral', trend, confidence = 0 }) {
  return (
    <span
      className="ai-behavior-chip ai-focusable"
      data-kind={kind}
      data-confidence={confidenceCategory(confidence)}
      tabIndex={0}
      title={`${behavior}: ${kind}${trend ? `, ${trend}` : ''}`}
    >
      <AiIcon name="behavior" label="Behavior" size="sm" />
      <span>{behavior}</span>
      {trend ? <small>{trend}</small> : null}
    </span>
  );
}
