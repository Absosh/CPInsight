import { aiDesignTokens } from '../tokens/designTokens.js';

export function createAiTheme(mode = 'dark', overrides = {}) {
  const semantic = aiDesignTokens.semantic[mode] || aiDesignTokens.semantic.dark;
  return Object.freeze({
    mode,
    tokens: aiDesignTokens,
    colors: Object.freeze({ ...semantic, ...(overrides.colors || {}) }),
    vars: Object.freeze({
      '--ai-bg-primary': semantic.bgPrimary || semantic.surface,
      '--ai-bg-secondary': semantic.bgSecondary || semantic.surfaceRaised,
      '--ai-surface': semantic.surface,
      '--ai-surface-raised': semantic.surfaceRaised,
      '--ai-surface-overlay': semantic.surfaceOverlay,
      '--ai-surface-hover': semantic.surfaceHover || semantic.surfaceOverlay,
      '--ai-surface-active': semantic.surfaceActive || semantic.surfaceRaised,
      '--ai-border': semantic.border,
      '--ai-border-strong': semantic.borderStrong,
      '--ai-divider': semantic.divider || semantic.border,
      '--ai-heading': semantic.heading || semantic.text,
      '--ai-text': semantic.text,
      '--ai-text-muted': semantic.textMuted,
      '--ai-text-subtle': semantic.textSubtle,
      '--ai-placeholder': semantic.placeholder || semantic.textSubtle,
      '--ai-primary': semantic.primary || semantic.info,
      '--ai-primary-hover': semantic.primaryHover || semantic.info,
      '--ai-secondary': semantic.secondary || semantic.evidence,
      '--ai-highlight': semantic.highlight || semantic.evidence,
      '--ai-glow': semantic.glow || semantic.focusRing,
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
