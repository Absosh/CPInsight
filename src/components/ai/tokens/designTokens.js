export const aiDesignTokens = Object.freeze({
  spacing: Object.freeze({
    none: '0',
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
    xxxl: '48px'
  }),
  radius: Object.freeze({
    none: '0',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '18px',
    pill: '999px'
  }),
  elevation: Object.freeze({
    none: 'none',
    sm: '0 8px 22px rgba(0, 0, 0, 0.16)',
    md: '0 18px 48px rgba(0, 0, 0, 0.26)',
    lg: '0 28px 80px rgba(0, 0, 0, 0.34)',
    glow: '0 0 34px var(--ai-glow)',
    raised: '0 18px 48px rgba(0, 0, 0, 0.26)',
    floating: '0 28px 80px rgba(0, 0, 0, 0.34)',
    focus: '0 0 0 3px var(--ai-focus-ring)'
  }),
  blur: Object.freeze({
    subtle: '8px',
    panel: '14px',
    modal: '22px'
  }),
  typography: Object.freeze({
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sizeXs: '0.75rem',
    sizeSm: '0.875rem',
    sizeMd: '1rem',
    sizeLg: '1.125rem',
    sizeXl: '1.375rem',
    lineTight: '1.25',
    lineNormal: '1.5',
    weightRegular: '400',
    weightMedium: '500',
    weightSemibold: '600',
    weightBold: '700'
  }),
  motion: Object.freeze({
    fast: '120ms',
    normal: '220ms',
    slow: '360ms',
    curveStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    curveEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)'
  }),
  icon: Object.freeze({
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px'
  }),
  breakpoints: Object.freeze({
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1440px'
  }),
  semantic: Object.freeze({
    dark: Object.freeze({
      bgPrimary: '#08111F',
      bgSecondary: '#0F172A',
      surface: '#08111F',
      surfaceRaised: 'rgba(18, 30, 52, 0.82)',
      surfaceOverlay: 'rgba(15, 23, 42, 0.72)',
      surfaceHover: 'rgba(59, 130, 246, 0.12)',
      surfaceActive: 'rgba(59, 130, 246, 0.18)',
      border: 'rgba(74, 144, 226, 0.18)',
      borderStrong: 'rgba(96, 165, 250, 0.38)',
      divider: 'rgba(147, 197, 253, 0.12)',
      text: '#F8FBFF',
      heading: '#FFFFFF',
      textMuted: '#A9B8D0',
      textSubtle: '#72839E',
      placeholder: '#6B7D98',
      focusRing: 'rgba(96, 165, 250, 0.42)',
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      secondary: '#60A5FA',
      highlight: '#93C5FD',
      glow: 'rgba(59, 130, 246, 0.25)',
      evidence: '#60A5FA',
      recommendation: '#93C5FD',
      reflection: '#f59e0b',
      behavior: '#34d399',
      warning: '#fbbf24',
      danger: '#fb7185',
      success: '#4ade80',
      info: '#60A5FA'
    }),
    light: Object.freeze({
      surface: '#f8fafc',
      surfaceRaised: '#ffffff',
      surfaceOverlay: 'rgba(255, 255, 255, 0.82)',
      border: '#d8e0ec',
      borderStrong: '#b8c5d8',
      text: '#0f172a',
      textMuted: '#475569',
      textSubtle: '#64748b',
      focusRing: '#0369a1',
      evidence: '#0369a1',
      recommendation: '#7c3aed',
      reflection: '#b45309',
      behavior: '#047857',
      warning: '#b45309',
      danger: '#be123c',
      success: '#15803d',
      info: '#2563eb'
    }),
    highContrast: Object.freeze({
      surface: '#000000',
      surfaceRaised: '#101010',
      surfaceOverlay: '#101010',
      border: '#ffffff',
      borderStrong: '#ffffff',
      text: '#ffffff',
      textMuted: '#f2f2f2',
      textSubtle: '#d7d7d7',
      focusRing: '#ffff00',
      evidence: '#00e5ff',
      recommendation: '#ff7aff',
      reflection: '#ffd400',
      behavior: '#00ff9c',
      warning: '#ffd400',
      danger: '#ff4d4d',
      success: '#00ff66',
      info: '#66aaff'
    })
  }),
  confidence: Object.freeze({
    low: '#fb7185',
    medium: '#fbbf24',
    high: '#38bdf8',
    verified: '#4ade80'
  }),
  state: Object.freeze({
    loading: '#94a3b8',
    streaming: '#38bdf8',
    success: '#4ade80',
    empty: '#64748b',
    partial: '#fbbf24',
    error: '#fb7185',
    retry: '#a78bfa',
    offline: '#f59e0b'
  })
});

export const aiStateNames = Object.freeze(['loading', 'streaming', 'success', 'empty', 'partial', 'error', 'retry', 'offline']);
