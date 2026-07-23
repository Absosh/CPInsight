import React from 'react';
import { percent } from '../base/componentUtils.js';

export function ConfidenceScale({ value = 0, label = 'Confidence scale' }) {
  return (
    <div className="ai-confidence-scale" aria-label={`${label}: ${percent(value)}`}>
      <span style={{ inlineSize: percent(value) }} />
    </div>
  );
}
