const activeSelections = new Map();

export function getSelection(scope = 'global') {
  return activeSelections.get(scope) || null;
}

export function selectVisualizationItem(selection) {
  const normalized = {
    scope: selection.scope || 'global',
    sourceId: selection.sourceId || null,
    entityType: selection.entityType || 'item',
    key: selection.key || selection.name || '',
    label: selection.label || selection.name || selection.key || '',
    payload: selection.payload || null
  };

  activeSelections.set(normalized.scope, normalized);
  window.dispatchEvent(new CustomEvent('cpinsight:visualization-select', { detail: normalized }));
  return normalized;
}

export function clearVisualizationSelection(scope = 'global') {
  activeSelections.delete(scope);
  window.dispatchEvent(new CustomEvent('cpinsight:visualization-clear', { detail: { scope } }));
}
