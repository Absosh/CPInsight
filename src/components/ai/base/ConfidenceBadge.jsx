import React from 'react';
import { confidenceCategory, percent } from './componentUtils.js';

export function ConfidenceBadge({ value = 0, label = 'Confidence', animated = false }) {
  const category = confidenceCategory(value);
  return (
    <span
      className="ai-confidence-badge ai-focusable"
      data-confidence={category}
      data-animated={animated}
      tabIndex={0}
      aria-label={`${label}: ${percent(value)} ${category}`}
      title={`${label}: ${percent(value)} (${category})`}
    >
      <span className="ai-confidence-dot" />
      <span>{percent(value)}</span>
    </span>
  );
}
