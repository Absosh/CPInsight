import React, { createContext, useContext, useMemo } from 'react';

const AiInteractionContext = createContext({
  onInspectEvidence: () => {},
  onOpenTimeline: () => {},
  onFeedback: () => {},
  onRetry: () => {}
});

export function AiInteractionProvider({ handlers = {}, children }) {
  const value = useMemo(() => ({
    onInspectEvidence: handlers.onInspectEvidence || (() => {}),
    onOpenTimeline: handlers.onOpenTimeline || (() => {}),
    onFeedback: handlers.onFeedback || (() => {}),
    onRetry: handlers.onRetry || (() => {})
  }), [handlers]);

  return <AiInteractionContext.Provider value={value}>{children}</AiInteractionContext.Provider>;
}

export function useAiInteractions() {
  return useContext(AiInteractionContext);
}
