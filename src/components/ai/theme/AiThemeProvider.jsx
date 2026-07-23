import React, { createContext, useContext, useMemo } from 'react';
import { createAiTheme } from './createTheme.js';

const AiThemeContext = createContext(createAiTheme('dark'));

export function AiThemeProvider({ mode = 'dark', overrides, children }) {
  const theme = useMemo(() => createAiTheme(mode, overrides), [mode, overrides]);
  return (
    <AiThemeContext.Provider value={theme}>
      <div className="ai-theme-root" data-ai-theme={theme.mode} style={theme.vars}>
        {children}
      </div>
    </AiThemeContext.Provider>
  );
}

export function useAiTheme() {
  return useContext(AiThemeContext);
}
