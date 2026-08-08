import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../components/ai/ai-components.css';
import { AiCoachView, AiCoachWorkspace, createInitialAiCoachState } from '../../features/ai-coach/index.js';

function initialStateFromUrl() {
  const state = createInitialAiCoachState();
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view') || window.location.hash.replace('#', '');
  const validViews = new Set(Object.values(AiCoachView));

  if (validViews.has(requestedView)) {
    state.activeView = requestedView;
  }

  return state;
}

const root = createRoot(document.getElementById('aiCoachRoot'));
root.render(<AiCoachWorkspace initialState={initialStateFromUrl()} />);
