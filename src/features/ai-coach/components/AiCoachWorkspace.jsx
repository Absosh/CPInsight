import React, { useRef } from 'react';
import { AiThemeProvider } from '../../../components/ai/index.js';
import { useAiCoachKeyboardShortcuts } from '../hooks/useAiCoachKeyboardShortcuts.js';
import { AiCoachWorkspaceProvider, useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { LeftSidebar } from './LeftSidebar.jsx';
import { CenterPanel } from './CenterPanel.jsx';
import { RightSidebar } from './RightSidebar.jsx';
import '../styles/ai-coach-workspace.css';

function WorkspaceShell() {
  const { state, dispatch, abortGeneration } = useAiCoachWorkspace();
  const searchInputRef = useRef(null);
  useAiCoachKeyboardShortcuts({
    onNewSession: () => dispatch({ type: 'sessions/created' }),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onAbort: abortGeneration,
    onToggleLeft: () => dispatch({ type: 'workspace/selectionChanged', selection: { leftPanelOpen: !state.selection.leftPanelOpen } }),
    onToggleRight: () => dispatch({ type: 'workspace/selectionChanged', selection: { rightPanelOpen: !state.selection.rightPanelOpen } })
  });

  return (
    <div className="coach-workspace" data-left-open={state.selection.leftPanelOpen} data-right-open={state.selection.rightPanelOpen}>
      <LeftSidebar searchInputRef={searchInputRef} />
      <CenterPanel />
      <RightSidebar />
    </div>
  );
}

export function AiCoachWorkspace({ apiClient, initialState }) {
  return (
    <AiThemeProvider mode={initialState?.preferences?.theme || 'dark'}>
      <AiCoachWorkspaceProvider apiClient={apiClient} initialState={initialState}>
        <WorkspaceShell />
      </AiCoachWorkspaceProvider>
    </AiThemeProvider>
  );
}
