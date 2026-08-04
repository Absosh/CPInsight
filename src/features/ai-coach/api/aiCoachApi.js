class AiCoachApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'AiCoachApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiCoachApiError(payload.error?.message || payload.error || `HTTP ${response.status}`, response.status, payload);
  }
  return payload;
}

function resolveDefaultBaseUrl() {
  const configured = globalThis.CPINSIGHT_API_BASE || globalThis.localStorage?.getItem('cpinsight:apiBaseUrl');
  if (configured) return configured.replace(/\/$/, '');
  const location = globalThis.location;
  const isLiveServer = ['localhost', '127.0.0.1'].includes(location?.hostname) && location?.port === '5500';
  if (isLiveServer) return 'http://localhost:4000/api';
  if (location?.protocol === 'http:' || location?.protocol === 'https:') return `${location.origin}/api`;
  return '/api';
}

function defaultTokenStore() {
  return {
    getAccessToken: () => globalThis.localStorage?.getItem('accessToken') || null,
    getRefreshToken: () => globalThis.localStorage?.getItem('refreshToken') || null,
    setTokens: ({ accessToken, refreshToken }) => {
      if (accessToken) globalThis.localStorage?.setItem('accessToken', accessToken);
      if (refreshToken) globalThis.localStorage?.setItem('refreshToken', refreshToken);
    },
    clearTokens: () => {
      globalThis.localStorage?.removeItem('accessToken');
      globalThis.localStorage?.removeItem('refreshToken');
    }
  };
}

export function createAiCoachApiClient({
  baseUrl = resolveDefaultBaseUrl(),
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  onUnauthorized,
  fetchImpl = globalThis.fetch
} = {}) {
  const tokenStore = defaultTokenStore();
  const readAccessToken = getAccessToken || tokenStore.getAccessToken;
  const readRefreshToken = getRefreshToken || tokenStore.getRefreshToken;
  const persistTokens = setTokens || tokenStore.setTokens;
  const removeTokens = clearTokens || tokenStore.clearTokens;
  let refreshPromise = null;

  async function refreshAccessToken() {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return false;
    if (!refreshPromise) {
      refreshPromise = fetchImpl(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
        .then(async (response) => {
          if (!response.ok) return false;
          const payload = await response.json().catch(() => ({}));
          if (!payload.accessToken || !payload.refreshToken) return false;
          persistTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
          return true;
        })
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  function handleUnauthorized() {
    removeTokens();
    if (onUnauthorized) {
      onUnauthorized();
    } else {
      globalThis.dispatchEvent?.(new CustomEvent('auth:logout'));
    }
  }

  async function request(endpoint, { signal, method = 'GET', body } = {}, retried = false) {
    const token = readAccessToken();
    const response = await fetchImpl(`${baseUrl}${endpoint}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 401 && !retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(endpoint, { signal, method, body }, true);
      handleUnauthorized();
    }
    return parseResponse(response);
  }

  return Object.freeze({
    classify(question, options, signal) {
      return request('/ai/planner/classify', { method: 'POST', body: { question, options }, signal });
    },
    plan(question, options, signal) {
      return request('/ai/planner/plan', { method: 'POST', body: { question, options }, signal });
    },
    retrieve(plan, options, signal) {
      return request('/ai/retrieval/execute', { method: 'POST', body: { plan, options }, signal });
    },
    buildReasoningContext(evidencePackage, options, signal) {
      return request('/ai/reasoning/context', { method: 'POST', body: { evidencePackage, options }, signal });
    },
    buildPrompt(reasoningContext, options, signal) {
      return request('/ai/reasoning/prompt', { method: 'POST', body: { reasoningContext, options }, signal });
    },
    buildExecutionPlan({ question, intent, reasoningContext, promptPackage }, signal) {
      return request('/ai/plan', { method: 'POST', body: { question, intent, reasoningContext, promptPackage }, signal });
    },
    executeRuntime(executionPlan, promptPackage, override, signal) {
      return request('/ai/runtime/execute', { method: 'POST', body: { executionPlan, promptPackage, override }, signal });
    },
    validate({ executionPlan, reasoningContext, evidencePackage, rawResponse }, signal) {
      return request('/ai/validate', { method: 'POST', body: { executionPlan, reasoningContext, evidencePackage, rawResponse }, signal });
    },
    listConversations(params = {}) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
      });
      return request(`/ai/conversations${search.toString() ? `?${search}` : ''}`);
    },
    getConversation(conversationId) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}`);
    },
    createConversation(body = {}) {
      return request('/ai/conversations', { method: 'POST', body });
    },
    addConversationMessage(conversationId, message) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: message });
    },
    updateConversation(conversationId, patch) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}`, { method: 'PATCH', body: patch });
    },
    deleteConversation(conversationId) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
    },
    archiveConversation(conversationId) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}/archive`, { method: 'POST', body: {} });
    },
    pinConversation(conversationId, pinned) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}/pin`, { method: 'POST', body: { pinned } });
    },
    renameConversation(conversationId, title) {
      return request(`/ai/conversations/${encodeURIComponent(conversationId)}/rename`, { method: 'POST', body: { title } });
    },
    searchConversations(query, limit = 20) {
      return request('/ai/conversations/search', { method: 'POST', body: { query, limit } });
    },
    getQuality(validationId) {
      return request(`/ai/quality/${validationId}`);
    },
    getReflections(userId) {
      return request(`/ai/reflections/${userId}`);
    },
    getUserProfile() {
      return request('/user/profile');
    },
    getCombinedAnalytics() {
      return request('/analytics/combined');
    },
    getLatestReview() {
      return request('/reviews/latest');
    },
    getBehaviorProfile() {
      return request('/behavior/profile');
    },
    getBehaviorFeatures(limit = 100) {
      return request(`/behavior/features?limit=${encodeURIComponent(limit)}`);
    },
    submitFeedback(feedback) {
      return request('/ai/feedback', { method: 'POST', body: feedback });
    }
  });
}

export { AiCoachApiError };
