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

export function createAiCoachApiClient({ baseUrl = '/api', getAccessToken = () => null, fetchImpl = globalThis.fetch } = {}) {
  async function request(endpoint, { signal, method = 'GET', body } = {}) {
    const token = getAccessToken();
    const response = await fetchImpl(`${baseUrl}${endpoint}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
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
      return request('/ai/tasks/plan', { method: 'POST', body: { question, intent, reasoningContext, promptPackage }, signal });
    },
    executeRuntime(executionPlan, promptPackage, override, signal) {
      return request('/ai/runtime/execute', { method: 'POST', body: { executionPlan, promptPackage, override }, signal });
    },
    validate({ executionPlan, reasoningContext, evidencePackage, rawResponse }, signal) {
      return request('/ai/validate', { method: 'POST', body: { executionPlan, reasoningContext, evidencePackage, rawResponse }, signal });
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
