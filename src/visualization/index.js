import './visualization.css';
import { CHART_REGISTRY, VISUALIZATION_GROUPS, resolveVisualizationTypes } from './registry.js';
import { createVisualizationLab, destroyVisualizationLab, getVisualizationLab } from './engine.js';
import { selectVisualizationItem, clearVisualizationSelection } from './selectionManager.js';

export {
  CHART_REGISTRY,
  VISUALIZATION_GROUPS,
  resolveVisualizationTypes,
  createVisualizationLab,
  destroyVisualizationLab,
  getVisualizationLab,
  selectVisualizationItem,
  clearVisualizationSelection
};

window.CPVisualization = {
  CHART_REGISTRY,
  VISUALIZATION_GROUPS,
  resolveVisualizationTypes,
  createVisualizationLab,
  destroyVisualizationLab,
  getVisualizationLab,
  selectVisualizationItem,
  clearVisualizationSelection
};

window.dispatchEvent(new CustomEvent('cpinsight:visualization-ready', {
  detail: window.CPVisualization
}));
