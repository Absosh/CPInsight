# API Reference

The CPInsight backend is an Express API. Routes are registered in `backend/src/routes/index.js` and `backend/src/app.js`.

Base URL in local development:

```text
http://localhost:4000
```

Most application routes are under `/api`. Health routes are mounted at `/health` and `/ready`.

## Authentication

Protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

## Public Endpoint Groups

- [Authentication API](authentication-api.md)
- [Analytics API](analytics-api.md)
- [Telemetry and Extension API](telemetry-api.md)

The Domain Event Bus is internal backend infrastructure and does not expose a public HTTP endpoint. Its contract is documented in [Domain Event Bus](../architecture/domain-event-bus.md).

Redis Event Distribution is internal backend infrastructure and does not expose a public HTTP endpoint. Its contract is documented in [Redis Event Distribution](../architecture/redis-event-distribution.md).

The WebSocket Gateway upgrades authenticated clients at `/realtime` by default. Its protocol is documented in [WebSocket Gateway](../architecture/websocket-gateway.md).

## Additional Current Endpoints

| Method | URL | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Process health |
| `GET` | `/ready` | No | Dependency readiness |
| `GET` | `/api/calendar/contests` | No | Contest calendar proxy/controller |
| `GET` | `/api/user/profile` | Yes | Current user profile |
| `PATCH` | `/api/user/profile` | Yes | Update profile |
| `POST` | `/api/user/profile/avatar` | Yes | Upload avatar image data |
| `DELETE` | `/api/user/profile/avatar` | Yes | Delete avatar |
| `GET` | `/api/user/colleges` | Yes | Search college list |
| `GET` | `/api/platforms/accounts` | Yes | List connected platform accounts |
| `POST` | `/api/platforms/connect` | Yes | Connect platform handle |
| `DELETE` | `/api/platforms/disconnect` | Yes | Disconnect platform handle |
| `POST` | `/api/platforms/sync` | Yes | Sync all accounts |
| `POST` | `/api/platforms/sync/:platform` | Yes | Sync one account |
| `POST` | `/api/telemetry/upload` | Yes | Observability SDK telemetry batch ingestion |
| `POST` | `/api/telemetry/session/start` | Yes | Start or resume live contest monitoring |
| `POST` | `/api/telemetry/events` | Yes | Submit live contest telemetry events |
| `POST` | `/api/telemetry/session/heartbeat` | Yes | Record live monitoring connection heartbeat |
| `POST` | `/api/telemetry/session/stop` | Yes | Stop live monitoring and queue contest review generation |
| `POST` | `/api/behavior/extract` | Yes | Run behavior reconstruction and feature extraction |
| `GET` | `/api/behavior/sessions` | Yes | List reconstructed behavior sessions |
| `GET` | `/api/behavior/profile` | Yes | Latest behavior profile |
| `GET` | `/api/behavior/features` | Yes | Behavior feature rows |
| `GET` | `/api/behavior/trends` | Yes | Historical feature trends |
| `POST` | `/api/knowledge/infer` | Yes | Run behavior knowledge inference from existing feature rows |
| `GET` | `/api/knowledge/graph` | Yes | Retrieve persisted knowledge nodes and edges |
| `GET` | `/api/knowledge/strengths` | Yes | Retrieve strength insights |
| `GET` | `/api/knowledge/weaknesses` | Yes | Retrieve weakness insights |
| `GET` | `/api/knowledge/patterns` | Yes | Retrieve recurring behavior patterns |
| `GET` | `/api/knowledge/evolution` | Yes | Retrieve historical insight rows |
| `GET` | `/api/knowledge/insights/:insightId/evidence` | Yes | Retrieve evidence rows for one insight |
| `POST` | `/api/ai/planner/classify` | Yes | Classify a question into planner intents |
| `POST` | `/api/ai/planner/plan` | Yes | Produce and persist a retrieval plan without retrieval |
| `GET` | `/api/ai/planner/intents` | Yes | List intent taxonomy |
| `GET` | `/api/ai/planner/sources` | Yes | List retrieval source metadata |
| `GET` | `/api/ai/planner/strategies` | Yes | List retrieval strategy metadata |
| `POST` | `/api/ai/retrieval/execute` | Yes | Execute a retrieval plan and persist an evidence package |
| `GET` | `/api/ai/retrieval/package/:id` | Yes | Fetch an evidence package |
| `GET` | `/api/ai/retrieval/cache` | Yes | Inspect retrieval cache statistics |
| `GET` | `/api/ai/retrieval/metrics` | Yes | Fetch retrieval metrics |
| `GET` | `/api/ai/retrieval/sources` | Yes | Inspect retrieval source adapter health |
| `GET` | `/api/ai/retrieval/health` | Yes | Inspect retrieval engine health |
| `POST` | `/api/ai/reasoning/context` | Yes | Build and persist a Reasoning Context from an Evidence Package |
| `POST` | `/api/ai/reasoning/prompt` | Yes | Build and persist a provider-independent Prompt Package |
| `GET` | `/api/ai/reasoning/ontology` | Yes | Return behavior ontology concepts |
| `GET` | `/api/ai/reasoning/context/:id` | Yes | Fetch a persisted Reasoning Context |
| `GET` | `/api/ai/reasoning/prompt/:id` | Yes | Fetch a persisted Prompt Package |
| `GET` | `/api/ai/reasoning/metrics` | Yes | Fetch reasoning metrics |
| `POST` | `/api/ai/tasks/route` | Yes | Route question and reasoning context to AI task candidates |
| `POST` | `/api/ai/tasks/plan` | Yes | Produce and persist an immutable AI Execution Plan |
| `GET` | `/api/ai/tasks` | Yes | List AI task plugins |
| `GET` | `/api/ai/strategies` | Yes | List prompt strategies |
| `GET` | `/api/ai/schemas` | Yes | List output schemas |
| `GET` | `/api/ai/policies` | Yes | List safety and evaluation policies |
| `GET` | `/api/ai/execution/:id` | Yes | Fetch a persisted AI Execution Plan |
| `POST` | `/api/ai/runtime/execute` | Yes | Execute an AI Execution Plan with non-streaming provider invocation |
| `POST` | `/api/ai/runtime/stream` | Yes | Execute an AI Execution Plan with provider-independent streaming |
| `GET` | `/api/ai/runtime/providers` | Yes | List runtime provider health |
| `GET` | `/api/ai/runtime/models` | Yes | List model registry metadata |
| `GET` | `/api/ai/runtime/metrics` | Yes | Fetch runtime metrics |
| `GET` | `/api/ai/runtime/health` | Yes | Fetch runtime health |
| `POST` | `/api/ai/runtime/cancel` | Yes | Cancel a runtime request |
| `POST` | `/api/ai/validate` | Yes | Validate raw LLM output into a grounded AI Coach response |
| `POST` | `/api/ai/reflections` | Yes | Store validated reflection objects |
| `POST` | `/api/ai/feedback` | Yes | Record human feedback for a validated response |
| `GET` | `/api/ai/quality/:id` | Yes | Fetch a validated response and quality report |
| `GET` | `/api/ai/reflections/:user` | Yes | Fetch authenticated user's reflection memory |
| `GET` | `/api/ai/feedback/metrics` | Yes | Fetch aggregate feedback metrics |
| `GET` | `/api/ai/validation/metrics` | Yes | Fetch validation metrics for the authenticated user |
| `GET` | `/api/debug/submissions/:platform` | Yes | Debug submission inspection |
| `GET` | `/api/debug/user-accounts` | Yes | Debug account inspection |

Debug endpoints are implemented and authenticated, but should not be treated as stable product APIs.

## Behavior Knowledge

Behavior knowledge endpoints are internal authenticated APIs. They expose graph and insight records produced from behavior features; they do not perform AI generation or recommendation.

### `POST /api/knowledge/infer`

Authentication: bearer token.

Body:

```json
{
  "windowKey": "all",
  "limit": 1000
}
```

Response status: `202`.

Response:

```json
{
  "runId": "uuid",
  "insightsGenerated": 7,
  "graphNodes": 8,
  "graphEdges": 7,
  "patternCount": 2,
  "metrics": {}
}
```

### `GET /api/knowledge/graph`

Authentication: bearer token.

Response:

```json
{
  "nodes": [],
  "edges": []
}
```

### `GET /api/knowledge/strengths`

Authentication: bearer token.

Response: strength rows from `behavior_insights`.

### `GET /api/knowledge/weaknesses`

Authentication: bearer token.

Response: weakness rows from `behavior_insights`.

### `GET /api/knowledge/patterns`

Authentication: bearer token.

Response: rows from `behavior_patterns`.

### `GET /api/knowledge/evolution`

Authentication: bearer token.

Response: all insight rows ordered by creation time.

### `GET /api/knowledge/insights/:insightId/evidence`

Authentication: bearer token.

Response: evidence rows joined through the authenticated user's insight ownership.

## AI Planner

Planner endpoints are internal authenticated APIs. They classify questions and create retrieval plans only. They do not retrieve data, build prompts, call an LLM, generate recommendations, or use embeddings.

### `POST /api/ai/planner/classify`

Authentication: bearer token.

Body:

```json
{
  "question": "Why did my rating drop?"
}
```

Response: intent classification with primary intent, secondary intents, confidence, ambiguity flag, and question hash.

### `POST /api/ai/planner/plan`

Authentication: bearer token.

Body:

```json
{
  "question": "What should I practice?",
  "options": {}
}
```

Response status: `202`.

Response: retrieval plan containing required evidence, selected sources, strategies, confidence plan, token budget, estimates, and execution priority.

### `GET /api/ai/planner/intents`

Authentication: bearer token.

Response: supported intent taxonomy.

### `GET /api/ai/planner/sources`

Authentication: bearer token.

Response: retrieval source metadata.

### `GET /api/ai/planner/strategies`

Authentication: bearer token.

Response: retrieval strategy metadata.

## AI Retrieval

Retrieval endpoints are internal authenticated APIs. They execute planner output and produce Evidence Packages only. They do not build prompts, invoke LLMs, generate recommendations, or use embeddings.

### `POST /api/ai/retrieval/execute`

Authentication: bearer token.

Body:

```json
{
  "plan": {
    "planId": "uuid",
    "questionHash": "sha256",
    "retrievalSources": []
  },
  "options": {}
}
```

Response status: `202`.

Response: immutable evidence package with metadata, retrieved source summaries, evidence, contradictions, confidence summary, missing evidence, and retrieval statistics.

### `GET /api/ai/retrieval/package/:id`

Authentication: bearer token.

Response: persisted evidence package row for the authenticated user.

### `GET /api/ai/retrieval/cache`

Authentication: bearer token.

Response: current process cache entry count, hits, misses, hit rate, and TTL.

### `GET /api/ai/retrieval/metrics`

Authentication: bearer token.

Response: retrieval execution metric rows.

### `GET /api/ai/retrieval/sources`

Authentication: bearer token.

Response: retrieval adapter health and reliability metadata.

### `GET /api/ai/retrieval/health`

Authentication: bearer token.

Response: aggregate retrieval health, source health, and cache stats.

## AI Reasoning

Reasoning endpoints are internal authenticated APIs. They build deterministic Reasoning Contexts and Prompt Packages only. They do not invoke LLMs, stream responses, create embeddings, or generate chat output.

### `POST /api/ai/reasoning/context`

Authentication: bearer token.

Body:

```json
{
  "evidencePackage": {
    "packageId": "uuid",
    "evidence": []
  },
  "options": {
    "budget": "8k"
  }
}
```

Response status: `202`.

Response: ontology-backed Reasoning Context.

### `POST /api/ai/reasoning/prompt`

Authentication: bearer token.

Body:

```json
{
  "reasoningContext": {
    "contextId": "uuid"
  },
  "options": {}
}
```

Response status: `202`.

Response: provider-independent Prompt Package.

### `GET /api/ai/reasoning/ontology`

Authentication: bearer token.

Response: ontology version and concepts.

### `GET /api/ai/reasoning/context/:id`

Authentication: bearer token.

Response: persisted reasoning context row.

### `GET /api/ai/reasoning/prompt/:id`

Authentication: bearer token.

Response: persisted prompt package row.

### `GET /api/ai/reasoning/metrics`

Authentication: bearer token.

Response: reasoning metric rows.

## AI Tasks

Task endpoints are internal authenticated APIs. They route tasks and create AI Execution Plans only. They do not invoke providers, stream output, generate responses, use embeddings, or implement chat.

### `POST /api/ai/tasks/route`

Authentication: bearer token.

Body:

```json
{
  "question": "Why did my rating drop?",
  "intent": { "primary": "diagnostic" },
  "reasoningContext": {}
}
```

Response: ordered task candidates.

### `POST /api/ai/tasks/plan`

Authentication: bearer token.

Body:

```json
{
  "question": "Why did my rating drop?",
  "intent": { "primary": "diagnostic" },
  "reasoningContext": {},
  "promptPackage": {}
}
```

Response status: `202`.

Response: immutable AI Execution Plan with task chain, reasoning modes, prompt strategies, output schemas, evaluation rules, safety constraints, and execution metadata.

### Metadata Endpoints

- `GET /api/ai/tasks`
- `GET /api/ai/strategies`
- `GET /api/ai/schemas`
- `GET /api/ai/policies`
- `GET /api/ai/execution/:id`

## AI Runtime

Runtime endpoints are internal authenticated APIs. They invoke providers and return raw responses. They do not validate responses, inject citations, detect hallucinations, manage conversation memory, call tools, or run agents.

### `POST /api/ai/runtime/execute`

Authentication: bearer token.

Body:

```json
{
  "executionPlan": {},
  "promptPackage": {},
  "override": {
    "provider": "openai",
    "model": "gpt-4.1-mini"
  }
}
```

Response status: `202`.

Response: raw runtime result with provider, model, raw response, retries, fallbacks, tokens, cost, and latency.

### `POST /api/ai/runtime/stream`

Authentication: bearer token.

Body: same as `/execute`.

Response status: `202`.

Response: buffered streaming result. Provider-independent streaming callbacks are implemented in the runtime engine; HTTP streaming transport is future work.

### Runtime Metadata

- `GET /api/ai/runtime/providers`
- `GET /api/ai/runtime/models`
- `GET /api/ai/runtime/metrics`
- `GET /api/ai/runtime/health`
- `POST /api/ai/runtime/cancel`

## AI Quality

Quality endpoints are internal authenticated APIs. They normalize and validate raw provider output, persist quality reports, store validated reflections, and record human feedback. They do not call LLM providers, perform retrieval, redesign prompts, or mutate evidence.

### `POST /api/ai/validate`

Authentication: bearer token.

Body:

```json
{
  "executionPlan": {},
  "reasoningContext": {},
  "evidencePackage": {},
  "rawResponse": {}
}
```

Response status: `202`.

Response: validated AI Coach response, validation report, quality report, behavior reflections, and regeneration request metadata.

### `POST /api/ai/reflections`

Authentication: bearer token.

Body:

```json
{
  "validationId": "uuid",
  "reflections": []
}
```

Response status: `201`.

Response: persisted reflection records.

### `POST /api/ai/feedback`

Authentication: bearer token.

Body:

```json
{
  "responseId": "uuid",
  "feedbackType": "helpful",
  "metadata": {}
}
```

Valid feedback types are `helpful`, `not_helpful`, `incorrect`, `too_generic`, `too_long`, `too_short`, and `needs_more_evidence`.

### Quality Metadata

- `GET /api/ai/quality/:id`
- `GET /api/ai/reflections/:user`
- `GET /api/ai/feedback/metrics`
- `GET /api/ai/validation/metrics`

## Health

### `GET /health`

Authentication: none.

Body: none.

Response: health status from `healthController.health`.

Errors: `500` if the process cannot complete the health handler.

Example:

```http
GET /health
```

### `GET /ready`

Authentication: none.

Body: none.

Response: readiness status from `healthController.readiness`, including dependency readiness semantics implemented by the controller.

Errors: dependency or server errors are returned through the global error handler.

## Calendar

### `GET /api/calendar/contests`

Authentication: none.

Body: none.

Response: contest calendar payload from `calendarController.getContests`.

Errors: controller-specific errors are returned through Express error handling.

Example:

```http
GET /api/calendar/contests
```

## User Profile

### `GET /api/user/profile`

Authentication: bearer token.

Body: none.

Response: current user profile.

Errors:

- `401`: missing or invalid bearer token.

### `PATCH /api/user/profile`

Authentication: bearer token.

Body fields accepted by `updateProfileSchema`:

```json
{
  "displayName": "Alice",
  "timezone": "Asia/Calcutta",
  "country": "India",
  "collegeId": "college-id",
  "preferences": {}
}
```

Snake-case equivalents are accepted for `display_name` and `college_id`.

Response: updated profile.

Errors:

- `400`: invalid body.
- `401`: missing or invalid bearer token.

### `POST /api/user/profile/avatar`

Authentication: bearer token.

Body:

```json
{
  "imageData": "data:image/jpeg;base64,..."
}
```

Response: avatar metadata from the user controller.

Errors:

- `400`: invalid or oversized image data.
- `401`: missing or invalid bearer token.

### `DELETE /api/user/profile/avatar`

Authentication: bearer token.

Body: none.

Response: avatar deletion result from the user controller.

Errors:

- `401`: missing or invalid bearer token.

### `GET /api/user/colleges`

Authentication: bearer token.

Query:

```text
search=<string up to 120 chars>
```

Response: matching college entries from the static college data set.

Errors:

- `400`: invalid query.
- `401`: missing or invalid bearer token.

## Platform Accounts

### `GET /api/platforms/accounts`

Authentication: bearer token.

Body: none.

Response: connected platform accounts for the current user.

### `POST /api/platforms/connect`

Authentication: bearer token.

Body:

```json
{
  "platform": "codeforces",
  "handle": "tourist"
}
```

Supported validation values: `codeforces`, `codechef`, `leetcode`, `atcoder`.

Response: connected platform account.

Errors:

- `400`: invalid platform or handle.
- `401`: missing or invalid bearer token.
- Service-specific platform errors from `platformService`.

### `DELETE /api/platforms/disconnect`

Authentication: bearer token.

Body:

```json
{
  "platform": "codeforces"
}
```

Response: disconnect result.

Errors:

- `400`: invalid platform.
- `401`: missing or invalid bearer token.

### `POST /api/platforms/sync`

Authentication: bearer token.

Body: none.

Response: synchronization result for all connected accounts.

Errors:

- `401`: missing or invalid bearer token.
- Platform client or persistence errors from service execution.

### `POST /api/platforms/sync/:platform`

Authentication: bearer token.

Path parameter:

```text
platform = codeforces | codechef | leetcode | atcoder
```

Body: none.

Response: synchronization result for the selected account.

Errors:

- `400`: invalid platform.
- `401`: missing or invalid bearer token.
- Platform client or persistence errors from service execution.

## Debug

Debug endpoints are authenticated but are not stable product API contracts.

### `GET /api/debug/submissions/:platform`

Authentication: bearer token.

Response:

```json
{
  "platform": "codeforces",
  "handle": "handle",
  "accountId": "uuid",
  "totalCount": "10",
  "submissions": []
}
```

Errors:

- `401`: missing or invalid bearer token.
- `500`: raw debug query error.

### `GET /api/debug/user-accounts`

Authentication: bearer token.

Response:

```json
{
  "userId": "uuid",
  "accounts": [],
  "totalSubmissionsInDb": "0"
}
```

Errors:

- `401`: missing or invalid bearer token.
- `500`: raw debug query error.
