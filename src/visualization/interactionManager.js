import {
  clearVisualizationSelection,
  getSelection,
  selectVisualizationItem
} from './selectionManager.js';

export { clearVisualizationSelection, getSelection, selectVisualizationItem };

export function onVisualizationSelection(listener) {
  window.addEventListener('cpinsight:visualization-select', listener);
  return () => window.removeEventListener('cpinsight:visualization-select', listener);
}
