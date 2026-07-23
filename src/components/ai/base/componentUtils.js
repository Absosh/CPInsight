export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function percent(value) {
  return `${Math.round(clamp(value) * 100)}%`;
}

export function confidenceCategory(value) {
  const score = clamp(value);
  if (score >= 0.9) return 'verified';
  if (score >= 0.72) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

export function stateLabel(state) {
  return state ? String(state).replace(/_/g, ' ') : 'success';
}

export function safeList(items) {
  return Array.isArray(items) ? items : [];
}
