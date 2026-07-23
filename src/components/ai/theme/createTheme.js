import { aiDesignTokens } from '../tokens/designTokens.js';

export function createAiTheme(mode = 'dark', overrides = {}) {
  const semantic = aiDesignTokens.semantic[mode] || aiDesignTokens.semantic.dark;
  return Object.freeze({
    mode,
    tokens: aiDesignTokens,
    colors: Object.freeze({ ...semantic, ...(overrides.colors || {}) }),
    vars: Object.freeze({
      '--ai-surface': semantic.surface,
      '--ai-surface-raised': semantic.surfaceRaised,
      '--ai-surface-overlay': semantic.surfaceOverlay,
      '--ai-border': semantic.border,
      '--ai-border-strong': semantic.borderStrong,
      '--ai-text': semantic.text,
      '--ai-text-muted': semantic.textMuted,
      '--ai-text-subtle': semantic.textSubtle,
      '--ai-focus-ring': semantic.focusRing,
      '--ai-evidence': semantic.evidence,
      '--ai-recommendation': semantic.recommendation,
      '--ai-reflection': semantic.reflection,
      '--ai-behavior': semantic.behavior,
      '--ai-warning': semantic.warning,
      '--ai-danger': semantic.danger,
      '--ai-success': semantic.success,
      '--ai-info': semantic.info,
      ...overrides.vars
    })
  });
}

export const aiThemes = Object.freeze({
  dark: createAiTheme('dark'),
  light: createAiTheme('light'),
  highContrast: createAiTheme('highContrast')
});
