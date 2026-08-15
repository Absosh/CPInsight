import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AiInteractionProvider } from '../../../components/ai/index.js';
import { createAiCoachApiClient } from '../api/aiCoachApi.js';
import { aiCoachReducer, createInitialAiCoachState } from './aiCoachReducer.js';
import { createWorkspaceId } from '../utils/id.js';

const AiCoachWorkspaceContext = createContext(null);
const LAST_CONVERSATION_KEY = 'cpinsight:ai:lastConversationId';
const DRAFT_KEY = 'cpinsight:ai:draft';
const SESSION_BACKUP_KEY = 'cpinsight:ai:sessionsBackup';

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

function normalizeConversation(conversation) {
  const normalized = {
    sessionId: conversation.sessionId || conversation.conversationId || conversation.id,
    conversationId: conversation.conversationId || conversation.sessionId || conversation.id,
    title: conversation.title || 'New chat',
    summary: conversation.summary || '',
    preview: conversation.preview || '',
    status: conversation.status || 'active',
    pinned: Boolean(conversation.pinned),
    archivedAt: conversation.archivedAt,
    deletedAt: conversation.deletedAt,
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: conversation.updatedAt || new Date().toISOString(),
    metadata: conversation.metadata || {}
  };
  if (Array.isArray(conversation.messages)) normalized.messages = conversation.messages;
  return normalized;
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

async function refreshConversationIfAvailable(api, sessionId) {
  try {
    return normalizeConversation(await api.getConversation(sessionId));
  } catch {
    return null;
  }
}

function validatedResponseFromResult(result) {
  return result?.validated?.validatedResponse
    || result?.validated?.validated_response
    || {};
}

function coachSummaryFromResult(result) {
  const response = validatedResponseFromResult(result);
  return response.summary
    || result?.rawResponse?.text
    || result?.rawResponse?.rawResponse
    || 'I generated a response, but the returned payload was missing its summary.';
}

function readSessionBackup() {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.sessions)
      ? parsed.sessions.map(normalizeConversation).filter((session) => session.sessionId)
      : [];
  } catch {
    return [];
  }
}

function writeSessionBackup(sessions = []) {
  try {
    const withMessages = sessions
      .filter((session) => Array.isArray(session.messages) && session.messages.length)
      .slice(0, 12);
    if (!withMessages.length) return;
    globalThis.localStorage?.setItem(SESSION_BACKUP_KEY, JSON.stringify({ sessions: withMessages, savedAt: new Date().toISOString() }));
  } catch {
    // Local backup is only a resilience layer; storage errors should not interrupt chat.
  }
}

export function AiCoachWorkspaceProvider({ apiClient, initialState, children }) {
  const [state, dispatch] = useReducer(aiCoachReducer, initialState || createInitialAiCoachState());
  const abortRef = useRef(null);
  const conversationsHydratedRef = useRef(false);
  const conversationSearchReadyRef = useRef(false);
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

  const selectConversation = useCallback(async (sessionId) => {
    if (!sessionId) return null;
    dispatch({ type: 'sessions/selected', sessionId });
    globalThis.localStorage?.setItem(LAST_CONVERSATION_KEY, sessionId);
    try {
      const conversation = normalizeConversation(await api.getConversation(sessionId));
      dispatch({ type: 'conversations/upserted', conversation, select: true, authoritative: true });
      return conversation;
    } catch (error) {
      dispatch({ type: 'conversations/failed', error: error.message });
      return null;
    }
  }, [api]);

  const loadConversations = useCallback(async () => {
    dispatch({ type: 'conversations/loading' });
    try {
      const payload = await api.listConversations({ includeArchived: true });
      const list = (payload.conversations || []).map(normalizeConversation);
      const cachedId = globalThis.localStorage?.getItem(LAST_CONVERSATION_KEY);
      let activeId = list.some((conversation) => conversation.sessionId === cachedId)
        ? cachedId
        : list[0]?.sessionId || null;
      let activeConversation = activeId ? await api.getConversation(activeId).then(normalizeConversation).catch(() => null) : null;
      const conversations = activeConversation
        ? list.map((conversation) => conversation.sessionId === activeId ? activeConversation : conversation)
        : list;
      dispatch({ type: 'conversations/loaded', conversations, activeSessionId: activeId, authoritative: true });
      if (activeId) globalThis.localStorage?.setItem(LAST_CONVERSATION_KEY, activeId);
    } catch (error) {
      const backup = readSessionBackup();
      if (backup.length) {
        const cachedId = globalThis.localStorage?.getItem(LAST_CONVERSATION_KEY);
        const activeId = backup.some((conversation) => conversation.sessionId === cachedId)
          ? cachedId
          : backup[0].sessionId;
        dispatch({ type: 'conversations/loaded', conversations: backup, activeSessionId: activeId });
      } else {
        dispatch({ type: 'conversations/failed', error: error.message });
      }
    } finally {
      conversationsHydratedRef.current = true;
    }
  }, [api]);

  useEffect(() => {
    writeSessionBackup(state.sessions);
  }, [state.sessions]);

  const startNewConversation = useCallback(async () => {
    const conversation = normalizeConversation(await api.createConversation({ title: 'New chat', metadata: { source: 'workspace' } }));
    dispatch({ type: 'conversations/upserted', conversation, select: true });
    globalThis.localStorage?.setItem(LAST_CONVERSATION_KEY, conversation.sessionId);
    return conversation;
  }, [api]);

  const renameConversation = useCallback(async (sessionId, title) => {
    const conversation = normalizeConversation(await api.renameConversation(sessionId, title));
    dispatch({ type: 'conversations/upserted', conversation });
    return conversation;
  }, [api]);

  const pinConversation = useCallback(async (sessionId, pinned) => {
    const conversation = normalizeConversation(await api.pinConversation(sessionId, pinned));
    dispatch({ type: 'conversations/upserted', conversation });
    return conversation;
  }, [api]);

  const archiveConversation = useCallback(async (sessionId) => {
    const conversation = normalizeConversation(await api.archiveConversation(sessionId));
    dispatch({ type: 'conversations/upserted', conversation });
    return conversation;
  }, [api]);

  const deleteConversation = useCallback(async (sessionId) => {
    await api.deleteConversation(sessionId);
    dispatch({ type: 'sessions/deleted', sessionId });
    if (state.activeSessionId === sessionId) {
      globalThis.localStorage?.removeItem(LAST_CONVERSATION_KEY);
      await loadConversations();
    }
  }, [api, loadConversations, state.activeSessionId]);

  const duplicateConversation = useCallback(async (sessionId) => {
    const cached = state.sessions.find((session) => session.sessionId === sessionId);
    const source = cached?.messages ? cached : await api.getConversation(sessionId).then(normalizeConversation);
    const duplicate = await api.createConversation({ title: `${source.title || 'Conversation'} copy`, summary: source.summary, metadata: { ...source.metadata, duplicatedFrom: sessionId } });
    const normalized = normalizeConversation(duplicate);
    for (const message of source.messages || []) {
      await api.addConversationMessage(normalized.sessionId, {
        messageId: createWorkspaceId('message'),
        role: message.role,
        content: message.content,
        status: message.status,
        sections: message.sections,
        metadata: message.metadata,
        error: message.error
      });
    }
    return selectConversation(normalized.sessionId);
  }, [api, selectConversation, state.sessions]);

  useEffect(() => {
    refreshInsights();
    loadConversations();
    return undefined;
  }, [refreshInsights, loadConversations]);

  useEffect(() => {
    if (!conversationsHydratedRef.current) return undefined;
    if (!conversationSearchReadyRef.current) {
      conversationSearchReadyRef.current = true;
      return undefined;
    }
    if (state.streaming.active) return undefined;
    const query = state.searchQuery.trim();
    const timeout = globalThis.setTimeout(async () => {
      if (!query) {
        loadConversations();
        return;
      }
      try {
        const payload = await api.searchConversations(query);
        const conversations = (payload.conversations || []).map(normalizeConversation);
        dispatch({ type: 'conversations/loaded', conversations, activeSessionId: state.activeSessionId });
      } catch (error) {
        dispatch({ type: 'conversations/failed', error: error.message });
      }
    }, 250);
    return () => globalThis.clearTimeout(timeout);
  }, [api, loadConversations, state.activeSessionId, state.searchQuery, state.streaming.active]);

  useEffect(() => {
    if (!globalThis.WebSocket || !globalThis.localStorage?.getItem('accessToken')) return undefined;
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
  }, [refreshInsights, state.contextualInsights.userId]);

  const submitQuestion = useCallback(async (question) => {
    const activeConversation = state.activeSessionId
      ? state.sessions.find((item) => item.sessionId === state.activeSessionId)
      : null;
    let ensuredSession = activeConversation;
    if (!ensuredSession) {
      try {
        ensuredSession = await startNewConversation();
      } catch (error) {
        dispatch({ type: 'conversations/failed', error: error.message });
        return;
      }
    }
    const sessionId = ensuredSession.sessionId;
    const session = ensuredSession.messages ? ensuredSession : state.sessions.find((item) => item.sessionId === sessionId);
    const conversationHistory = conversationHistoryForSession(session);
    const userMessageId = createWorkspaceId('message');
    const coachMessageId = createWorkspaceId('message');
    const abortController = new AbortController();
    let coachMessagePersisted = false;
    abortRef.current = abortController;
    dispatch({ type: 'messages/userSubmitted', question, userMessageId, coachMessageId });
    try {
      await api.addConversationMessage(sessionId, {
        messageId: userMessageId,
        role: 'user',
        content: question,
        status: 'completed',
        metadata: { source: 'workspace' }
      });
      await api.addConversationMessage(sessionId, {
        messageId: coachMessageId,
        role: 'coach',
        content: '',
        status: 'queued',
        metadata: { question }
      });
      coachMessagePersisted = true;
      const result = await executeCoachPipeline({ api, question, signal: abortController.signal, dispatch, sessionId, coachMessageId, conversationHistory });
      const validatedResponse = validatedResponseFromResult(result);
      const completedMessage = {
        content: coachSummaryFromResult(result),
        sections: {
          response: validatedResponse,
          quality: result.validated?.qualityReport,
          reasoning: result.reasoningContext,
          evidence: result.evidencePackage?.evidence,
          recommendations: validatedResponse.recommendations || [],
          references: validatedResponse.citations || [],
          actionItems: validatedResponse.recommendations || []
        },
        metadata: {
          question,
          validationId: result.validated?.validationId,
          executionPlanId: result.executionPlan?.executionPlanId,
          evidencePackageId: result.evidencePackage?.packageId
        }
      };
      await api.addConversationMessage(sessionId, {
        messageId: coachMessageId,
        role: 'coach',
        status: 'completed',
        ...completedMessage
      });
      dispatch({
        type: 'messages/completed',
        sessionId,
        messageId: coachMessageId,
        message: completedMessage
      });
      const refreshedConversation = await refreshConversationIfAvailable(api, sessionId);
      if (refreshedConversation?.messages?.length) {
        dispatch({ type: 'conversations/upserted', conversation: refreshedConversation, select: true, authoritative: true });
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        dispatch({ type: 'messages/aborted', sessionId, messageId: coachMessageId });
        if (coachMessagePersisted) {
          await api.addConversationMessage(sessionId, {
            messageId: coachMessageId,
            role: 'coach',
            content: '',
            status: 'aborted',
            metadata: { question }
          }).catch(() => {});
        }
        return;
      }
      dispatch({ type: 'messages/failed', sessionId, messageId: coachMessageId, error: error.message });
      if (coachMessagePersisted) {
        await api.addConversationMessage(sessionId, {
          messageId: coachMessageId,
          role: 'coach',
          content: '',
          status: 'failed',
          error: error.message,
          metadata: { question }
        }).catch(() => {});
      }
    } finally {
      if (abortRef.current === abortController) abortRef.current = null;
    }
  }, [api, startNewConversation, state.activeSessionId, state.sessions]);

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
    loadConversations,
    startNewConversation,
    selectConversation,
    renameConversation,
    pinConversation,
    archiveConversation,
    deleteConversation,
    duplicateConversation,
    draftStorageKey: DRAFT_KEY,
    api
  }), [state, submitQuestion, abortGeneration, refreshInsights, loadConversations, startNewConversation, selectConversation, renameConversation, pinConversation, archiveConversation, deleteConversation, duplicateConversation, api]);

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
