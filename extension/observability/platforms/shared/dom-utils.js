export function textContent(documentRef, selectors) {
  for (const selector of selectors) {
    const value = documentRef.querySelector(selector)?.textContent?.trim();
    if (value) return value.replace(/\s+/g, ' ');
  }
  return null;
}

export function readMetaContent(documentRef, names) {
  for (const name of names) {
    const value = documentRef.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content?.trim();
    if (value) return value;
  }
  return null;
}

export function parseDateTime(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function navigationType(performanceRef) {
  const entry = performanceRef?.getEntriesByType?.('navigation')?.[0];
  return entry?.type || 'navigate';
}
