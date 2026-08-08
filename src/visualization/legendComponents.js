import { visualizationPalette } from './themeAdapter.js';

export function createLegendOptions(overrides = {}) {
  return {
    textStyle: { color: visualizationPalette.muted },
    icon: 'circle',
    itemGap: 14,
    ...overrides
  };
}
