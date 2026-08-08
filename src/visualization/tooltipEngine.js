import { visualizationPalette } from './themeAdapter.js';

export function createTooltipOptions(overrides = {}) {
  return {
    trigger: 'item',
    confine: true,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderColor: visualizationPalette.border,
    borderWidth: 1,
    textStyle: { color: visualizationPalette.text },
    extraCssText: 'border-radius: 8px; box-shadow: 0 18px 40px rgba(0,0,0,0.32);',
    ...overrides
  };
}
