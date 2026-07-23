import { AiCoachMessageStatus, AiCoachSessionStatus, AiCoachView } from '../types/aiCoachTypes.js';
import { createWorkspaceId } from '../utils/id.js';

export function createInitialAiCoachState(now = new Date().toISOString()) {
  const sessionId = createWorkspaceId('session');
  return {
    activeView: AiCoachView.conversation,
    activeSessionId: sessionId,
    searchQuery: '',
    filters: { status: 'all', confidence: 'all', topic: 'all' },
    selection: { evidenceId: null, reasoningOpen: true, rightPanelOpen: true, leftPanelOpen: true },
    streaming: { active: false, messageId: null, abortController: null },
    preferences: { theme: 'dark', density: 'comfortable', reducedMotion: false },
    sessions: [{
      sessionId,
      title: 'New coaching session',
      summary: 'Ask CPInsight about your competitive programming behavior.',
      status: AiCoachSessionStatus.active,
      pinned: true,
      createdAt: now,
      updatedAt: now,
      metadata: { source: 'workspace' },
      messages: []
    }],
    contextualInsights: {
      currentRating: null,
      targetRating: null,
      currentGoal: 'Build consistent contest execution',
      learningVelocity: 'insufficient evidence',
      behaviorSummary: [],
      recentReflections: [],
      weakestTopics: [],
      strongestTopics: [],
      todaysRecommendations: []
    },
    recommendationActions: {},
    savedReports: [],
    errors: []
  };
}

function updateSession(state, sessionId, updater) {
  return {
    ...state,
    sessions: state.sessions.map((session) => session.sessionId === sessionId ? updater(session) : session)
  };
}

function activeSession(state) {
  return state.sessions.find((session) => session.sessionId === state.activeSessionId);
}

export function aiCoachReducer(state, action) {
  switch (action.type) {
    case 'workspace/viewChanged':
      return { ...state, activeView: action.view };
    case 'workspace/searchChanged':
      return { ...state, searchQuery: action.query };
    case 'workspace/filterChanged':
      return { ...state, filters: { ...state.filters, [action.key]: action.value } };
    case 'workspace/preferencesChanged':
      return { ...state, preferences: { ...state.preferences, ...action.preferences } };
    case 'workspace/selectionChanged':
      return { ...state, selection: { ...state.selection, ...action.selection } };
    case 'sessions/created': {
      const now = action.now || new Date().toISOString();
      const session = {
        sessionId: createWorkspaceId('session'),
        title: action.title || 'New coaching session',
        summary: '',
        status: AiCoachSessionStatus.active,
        pinned: false,
        createdAt: now,
        updatedAt: now,
        metadata: action.metadata || {},
        messages: []
      };
      return { ...state, activeSessionId: session.sessionId, activeView: AiCoachView.conversation, sessions: [session, ...state.sessions] };
    }
    case 'sessions/selected':
      return { ...state, activeSessionId: action.sessionId, activeView: AiCoachView.conversation };
    case 'sessions/renamed':
      return updateSession(state, action.sessionId, (session) => ({ ...session, title: action.title, updatedAt: action.now || new Date().toISOString() }));
    case 'sessions/pinned':
      return updateSession(state, action.sessionId, (session) => ({ ...session, pinned: action.pinned, updatedAt: action.now || new Date().toISOString() }));
    case 'sessions/archived':
      return updateSession(state, action.sessionId, (session) => ({ ...session, status: AiCoachSessionStatus.archived, updatedAt: action.now || new Date().toISOString() }));
    case 'sessions/deleted':
      return updateSession(state, action.sessionId, (session) => ({ ...session, status: AiCoachSessionStatus.deleted, updatedAt: action.now || new Date().toISOString() }));
    case 'messages/userSubmitted': {
      const session = activeSession(state);
      if (!session) return state;
      const now = action.now || new Date().toISOString();
      const userMessage = {
        messageId: createWorkspaceId('message'),
        role: 'user',
        content: action.question,
        status: AiCoachMessageStatus.completed,
        createdAt: now
      };
      const coachMessage = {
        messageId: action.coachMessageId || createWorkspaceId('message'),
        role: 'coach',
        content: '',
        status: AiCoachMessageStatus.queued,
        createdAt: now,
        sections: {}
      };
      return updateSession(state, session.sessionId, (item) => ({
        ...item,
        title: item.messages.length ? item.title : action.question.slice(0, 72),
        updatedAt: now,
        messages: [...item.messages, userMessage, coachMessage]
      }));
    }
    case 'messages/streamingStarted':
      return {
        ...updateSession(state, action.sessionId, (session) => ({
          ...session,
          messages: session.messages.map((message) => message.messageId === action.messageId ? { ...message, status: AiCoachMessageStatus.streaming } : message)
        })),
        streaming: { active: true, messageId: action.messageId, abortController: action.abortController || null }
      };
    case 'messages/streamingChunk':
      return updateSession(state, action.sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) => message.messageId === action.messageId ? { ...message, content: `${message.content}${action.chunk}` } : message)
      }));
    case 'messages/completed':
      return {
        ...updateSession(state, action.sessionId, (session) => ({
          ...session,
          updatedAt: action.now || new Date().toISOString(),
          messages: session.messages.map((message) => message.messageId === action.messageId ? { ...message, ...action.message, status: AiCoachMessageStatus.completed } : message)
        })),
        streaming: { active: false, messageId: null, abortController: null }
      };
    case 'messages/failed':
      return {
        ...updateSession(state, action.sessionId, (session) => ({
          ...session,
          messages: session.messages.map((message) => message.messageId === action.messageId ? { ...message, status: AiCoachMessageStatus.failed, error: action.error } : message)
        })),
        streaming: { active: false, messageId: null, abortController: null },
        errors: [{ message: action.error, createdAt: new Date().toISOString() }, ...state.errors].slice(0, 10)
      };
    case 'messages/aborted':
      return {
        ...updateSession(state, action.sessionId, (session) => ({
          ...session,
          messages: session.messages.map((message) => message.messageId === action.messageId ? { ...message, status: AiCoachMessageStatus.aborted } : message)
        })),
        streaming: { active: false, messageId: null, abortController: null }
      };
    case 'messages/copied':
      return { ...state, selection: { ...state.selection, copiedMessageId: action.messageId } };
    case 'messages/exported':
      return {
        ...state,
        savedReports: [{
          reportId: createWorkspaceId('report'),
          messageId: action.messageId,
          title: action.title || 'AI Coach report',
          payload: action.payload,
          createdAt: action.now || new Date().toISOString()
        }, ...state.savedReports]
      };
    case 'recommendations/actionRecorded':
      return {
        ...state,
        recommendationActions: {
          ...state.recommendationActions,
          [action.recommendationId]: {
            action: action.action,
            updatedAt: action.now || new Date().toISOString()
          }
        }
      };
    case 'insights/loaded':
      return { ...state, contextualInsights: { ...state.contextualInsights, ...action.insights } };
    default:
      return state;
  }
}
