import React from 'react';
import { AiIcon } from '../base/Icon.jsx';
import { ConfidenceBadge } from '../base/ConfidenceBadge.jsx';

export function SourceReference({ source, onInspect }) {
  const item = source || {};
  return (
    <button className="ai-source-reference ai-focusable" type="button" onClick={() => onInspect?.(item)} aria-label={`Inspect source ${item.label || item.type || 'reference'}`}>
      <AiIcon name="source" label="Source" />
      <span>
        <strong>{item.label || item.origin || 'Source reference'}</strong>
        <small>{item.type || item.sourceType || 'evidence'}</small>
      </span>
      <ConfidenceBadge value={item.confidence || 0} label="Source confidence" />
    </button>
  );
}
