import React from 'react';

export const aiIconMap = Object.freeze({
  evidence: 'FileSearch',
  recommendation: 'Route',
  confidence: 'Gauge',
  reflection: 'History',
  behavior: 'Brain',
  contest: 'Trophy',
  roadmap: 'Map',
  warning: 'TriangleAlert',
  success: 'CircleCheck',
  failure: 'CircleX',
  insight: 'Sparkles',
  quality: 'ShieldCheck',
  source: 'Link',
  time: 'Clock',
  progress: 'ListChecks'
});

const fallbackGlyphs = Object.freeze({
  evidence: 'EV',
  recommendation: 'RC',
  confidence: 'CF',
  reflection: 'RF',
  behavior: 'BH',
  contest: 'CT',
  roadmap: 'RM',
  warning: 'WA',
  success: 'OK',
  failure: 'ER',
  insight: 'IN',
  quality: 'QA',
  source: 'SR',
  time: 'TM',
  progress: 'PG'
});

export function AiIcon({ name = 'insight', label, size = 'md' }) {
  return (
    <span
      aria-label={label || name}
      className={`ai-icon ai-icon-${size}`}
      data-lucide-preferred={aiIconMap[name] || aiIconMap.insight}
      role="img"
    >
      {fallbackGlyphs[name] || fallbackGlyphs.insight}
    </span>
  );
}
