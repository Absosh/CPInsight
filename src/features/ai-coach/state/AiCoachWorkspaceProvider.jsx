import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AiInteractionProvider } from '../../../components/ai/index.js';
import { createAiCoachApiClient } from '../api/aiCoachApi.js';
import { aiCoachReducer, createInitialAiCoachState } from './aiCoachReducer.js';
import { createWorkspaceId } from '../utils/id.js';

const AiCoachWorkspaceContext = createContext(null);

function settledValue(result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function latestRating(analytics) {
  const progression = analytics?.ratingProgression || [];
  return analytics?.currentRating || progression[progression.length - 1]?.rating || null;
}

function normalizeRecommendation(item, index) {
  if (typeof item === 'string') {
    return {
      id: `review-recommendation-${index}`,
      title: item,
      recommendation: item,
      priority: index < 2 ? 'high' : 'medium',
      confidence: 0.72,
      estimatedTime: '45 minutes'
    };
  }
  return {
    id: item.id || item.recommendationId || `review-recommendation-${index}`,
    title: item.title || item.recommendation || `Recommendation ${index + 1}`,
    recommendation: item.recommendation || item.description || item.nextAction,
    description: item.description || item.reason || item.nextAction,
    priority: item.priority || (index < 2 ? 'high' : 'medium'),
    confidence: item.confidence || item.expectedImpact || 0.72,
    estimatedTime: item.estimatedTime || item.estimated_time || '45 minutes',
    difficulty: item.difficulty || 'moderate',
    topic: item.topic,
    evidence: item.evidence || item.evidenceIds || item.citations || []
  };
}

function normalizeReflection(row) {
  const payload = row.payload || row;
  return {
    reflectionId: payload.reflectionId || row.reflection_id || row.id,
    type: payload.type || row.reflection_type || 'pattern',
    behaviorFinding: payload.behaviorFinding || row.behavior_finding || 'Behavior pattern',
    confidence: payload.confidence || row.confidence || 0.7,
    importance: payload.importance || row.importance,
    createdAt: payload.createdAt || row.created_at,
    supportingEvidence: payload.supportingEvidence || payload.evidence || []
  };
}

function insightsFromSources({ profile, analytics, latestReview, behaviorProfile, behaviorFeatures, reflections }) {
  const review = latestReview?.review || latestReview || {};
  const reviewResponse = review.validatedResponse || review.validated_response || {};
  const reviewRecommendations = (review.recommendations || reviewResponse.recommendations || []).map(normalizeRecommendation);
  const normalizedReflections = [
    ...(review.reflections || []),
    ...((reflections?.reflections || reflections || []))
  ].map(normalizeReflection);
  const topics = analytics?.topicStrength || [];
  const strongestTopics = topics.slice().sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 4).map((topic) => ({ name: topic.topic, score: topic.strength }));
  const weakestTopics = topics.slice().sort((a, b) => (a.strength || 0) - (b.strength || 0)).slice(0, 4).map((topic) => ({ name: topic.topic, score: topic.strength }));
  const currentRating = latestRating(analytics) || profile?.platformAccounts?.find((account) => account.rating)?.rating || null;
  const targetRating = profile?.profile?.preferences?.targetRating || (currentRating ? Math.ceil((currentRating + 200) / 100) * 100 : 1600);

  return {
    userId: profile?.user?.id || null,
    currentRating,
    targetRating,
    currentGoal: reviewRecommendations[0]?.title || review.roadmap?.currentStage || 'Build consistent contest execution',
    learningVelocity: analytics?.ratingProgression?.length >= 2 ? 'based on recent rating history' : 'insufficient evidence',
    behaviorSummary: [
      ...strongestTopics.slice(0, 2).map((topic) => ({ name: topic.name, kind: 'strength', trend: 'stable', confidence: 0.78 })),
      ...weakestTopics.slice(0, 2).map((topic) => ({ name: topic.name, kind: 'weakness', trend: 'needs attention', confidence: 0.74 }))
    ],
    recentReflections: normalizedReflections.slice(0, 8),
    weakestTopics,
    strongestTopics,
    todaysRecommendations: reviewRecommendations.slice(0, 6),
    analytics,
    latestReview: review,
    behaviorProfile,
    behaviorFeatures: behaviorFeatures?.features || behaviorFeatures || []
  };
}

function conversationHistoryForSession(session, limit = 8) {
  return (session?.messages || [])
    .filter((message) => message.status === 'completed' && message.content && message.content.trim())
    .map((message) => ({
      role: message.role === 'coach' ? 'assistant' : 'user',
      content: message.content,
      createdAt: message.createdAt
    }))
    .slice(-limit);
}

async function executeCoachPipeline({ api, question, signal, dispatch, sessionId, coachMessageId, conversationHistory = [] }) {
  dispatch({ type: 'messages/streamingStarted', sessionId, messageId: coachMessageId });
  dispatch({ type: 'messages/streamingChunk', sessionId, messageId: coachMessageId, chunk: 'Planning evidence...' });
  const classification = await api.classify(question, {}, signal);
  const plan = await api.plan(question, {}, signal);
  dispatch({ type: 'messages/streamingChunk', sessionId, messageId: coachMessageId, chunk: '\nRetrieving evidence...' });
  const evidencePackage = await api.retrieve(plan, {}, signal);
  const reasoningContext = await api.buildReasoningContext(evidencePackage, { budget: '8k', conversationHistory }, signal);
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

  const refreshInsights = useCallback(async () => {
    dispatch({ type: 'insights/loading' });
    try {
      const profileResult = await api.getUserProfile().catch(() => null);
      const userId = profileResult?.user?.id;
      const [analyticsResult, reviewResult, behaviorProfileResult, behaviorFeaturesResult, reflectionsResult] = await Promise.allSettled([
        api.getCombinedAnalytics(),
        api.getLatestReview(),
        api.getBehaviorProfile(),
        api.getBehaviorFeatures(120),
        userId ? api.getReflections(userId) : Promise.resolve({ reflections: [] })
      ]);
      dispatch({
        type: 'insights/loaded',
        insights: insightsFromSources({
          profile: profileResult,
          analytics: settledValue(analyticsResult, {}),
          latestReview: settledValue(reviewResult, {}),
          behaviorProfile: settledValue(behaviorProfileResult, {}),
          behaviorFeatures: settledValue(behaviorFeaturesResult, []),
          reflections: settledValue(reflectionsResult, { reflections: [] })
        })
      });
    } catch (error) {
      dispatch({ type: 'insights/failed', error: error.message });
    }
  }, [api]);

  useEffect(() => {
    if (initialState) return undefined;
    refreshInsights();
    return undefined;
  }, [initialState, refreshInsights]);

  useEffect(() => {
    if (initialState || !globalThis.WebSocket || !globalThis.localStorage?.getItem('accessToken')) return undefined;
    const origin = globalThis.location?.origin || 'http://localhost:4000';
    const realtimeOrigin = /:(5500|5173)$/.test(origin) ? 'http://localhost:4000' : origin;
    const url = new URL('/realtime', realtimeOrigin.replace(/^http/, 'ws'));
    url.searchParams.set('token', globalThis.localStorage.getItem('accessToken'));
    let socket;
    try {
      socket = new WebSocket(url.toString());
      socket.addEventListener('open', () => {
        const userId = state.contextualInsights.userId;
        if (userId) socket.send(JSON.stringify({ messageType: 'SUBSCRIBE', payload: { channel: `user:${userId}` } }));
        socket.send(JSON.stringify({ messageType: 'SUBSCRIBE', payload: { channel: 'system' } }));
      });
      socket.addEventListener('message', (message) => {
        try {
          const frame = JSON.parse(message.data);
          const type = frame.metadata?.domainEventType || frame.messageType || frame.type;
          if (['review.completed', 'review.ready'].includes(type)) refreshInsights();
        } catch {
          // Status refresh is opportunistic; malformed realtime frames should not break the workspace.
        }
      });
    } catch {
      return undefined;
    }
    return () => socket?.close();
  }, [initialState, refreshInsights, state.contextualInsights.userId]);

  const submitQuestion = useCallback(async (question) => {
    const sessionId = state.activeSessionId;
    const session = state.sessions.find((item) => item.sessionId === sessionId);
    const conversationHistory = conversationHistoryForSession(session);
    const coachMessageId = createWorkspaceId('message');
    const abortController = new AbortController();
    abortRef.current = abortController;
    dispatch({ type: 'messages/userSubmitted', question, coachMessageId });
    try {
      const result = await executeCoachPipeline({ api, question, signal: abortController.signal, dispatch, sessionId, coachMessageId, conversationHistory });
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
    refreshInsights,
    api
  }), [state, submitQuestion, abortGeneration, refreshInsights, api]);

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
