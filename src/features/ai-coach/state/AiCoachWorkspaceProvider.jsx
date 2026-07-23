import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import { AiInteractionProvider } from '../../../components/ai/index.js';
import { createAiCoachApiClient } from '../api/aiCoachApi.js';
import { aiCoachReducer, createInitialAiCoachState } from './aiCoachReducer.js';
import { createWorkspaceId } from '../utils/id.js';

const AiCoachWorkspaceContext = createContext(null);

async function executeCoachPipeline({ api, question, signal, dispatch, sessionId, coachMessageId }) {
  dispatch({ type: 'messages/streamingStarted', sessionId, messageId: coachMessageId });
  dispatch({ type: 'messages/streamingChunk', sessionId, messageId: coachMessageId, chunk: 'Planning evidence...' });
  const classification = await api.classify(question, {}, signal);
  const plan = await api.plan(question, {}, signal);
  dispatch({ type: 'messages/streamingChunk', sessionId, messageId: coachMessageId, chunk: '\nRetrieving evidence...' });
  const evidencePackage = await api.retrieve(plan, {}, signal);
  const reasoningContext = await api.buildReasoningContext(evidencePackage, { budget: '8k' }, signal);
  const promptPackage = await api.buildPrompt(reasoningContext, {}, signal);
  const executionPlan = await api.buildExecutionPlan({ question, intent: classification, reasoningContext, promptPackage }, signal);
  dispatch({ type: 'messages/streamingChunk', sessionId, messageId: coachMessageId, chunk: '\nGenerating coach response...' });
  const rawResponse = await api.executeRuntime(executionPlan, promptPackage, {}, signal);
  const validated = await api.validate({ executionPlan, reasoningContext, evidencePackage, rawResponse }, signal);
  return { classification, plan, evidencePackage, reasoningContext, promptPackage, executionPlan, rawResponse, validated };
}

export function AiCoachWorkspaceProvider({ apiClient, initialState, children }) {
  const [state, dispatch] = useReducer(aiCoachReducer, initialState || createInitialAiCoachState());
  const abortRef = useRef(null);
  const api = useMemo(() => apiClient || createAiCoachApiClient({
    getAccessToken: () => globalThis.localStorage?.getItem('accessToken') || null
  }), [apiClient]);

  const submitQuestion = useCallback(async (question) => {
    const sessionId = state.activeSessionId;
    const coachMessageId = createWorkspaceId('message');
    const abortController = new AbortController();
    abortRef.current = abortController;
    dispatch({ type: 'messages/userSubmitted', question, coachMessageId });
    try {
      const result = await executeCoachPipeline({ api, question, signal: abortController.signal, dispatch, sessionId, coachMessageId });
      dispatch({
        type: 'messages/completed',
        sessionId,
        messageId: coachMessageId,
        message: {
          content: result.validated.validatedResponse.summary,
          sections: {
            response: result.validated.validatedResponse,
            quality: result.validated.qualityReport,
            reasoning: result.reasoningContext,
            evidence: result.evidencePackage.evidence,
            recommendations: result.validated.validatedResponse.recommendations,
            references: result.validated.validatedResponse.citations,
            actionItems: result.validated.validatedResponse.recommendations
          },
          metadata: {
            question,
            validationId: result.validated.validationId,
            executionPlanId: result.executionPlan.executionPlanId,
            evidencePackageId: result.evidencePackage.packageId
          }
        }
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        dispatch({ type: 'messages/aborted', sessionId, messageId: coachMessageId });
        return;
      }
      dispatch({ type: 'messages/failed', sessionId, messageId: coachMessageId, error: error.message });
    }
  }, [api, state.activeSessionId]);

  const abortGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const interactions = useMemo(() => ({
    onInspectEvidence: (evidence) => dispatch({ type: 'workspace/selectionChanged', selection: { evidenceId: evidence.evidenceId || evidence.id, rightPanelOpen: true } }),
    onOpenTimeline: () => dispatch({ type: 'workspace/viewChanged', view: 'reflections' }),
    onFeedback: (feedback) => api.submitFeedback(feedback),
    onRetry: () => {}
  }), [api]);

  const value = useMemo(() => ({
    state,
    dispatch,
    submitQuestion,
    abortGeneration,
    api
  }), [state, submitQuestion, abortGeneration, api]);

  return (
    <AiCoachWorkspaceContext.Provider value={value}>
      <AiInteractionProvider handlers={interactions}>
        {children}
      </AiInteractionProvider>
    </AiCoachWorkspaceContext.Provider>
  );
}

export function useAiCoachWorkspace() {
  const value = useContext(AiCoachWorkspaceContext);
  if (!value) throw new Error('useAiCoachWorkspace must be used inside AiCoachWorkspaceProvider');
  return value;
}
