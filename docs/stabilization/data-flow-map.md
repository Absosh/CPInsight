# CPInsight Data Flow Map

This document records the data paths used by the current application. PostgreSQL is the durable source of truth for synchronized platform facts, analytics cache rows, AI conversations, and AI messages. Redis is an expendable cache and event transport.

## Platform Connection

`pages/platforms.html`
-> `script/platforms.js`
-> `script/services/platformService.js`
-> `POST /api/platforms/connect`
-> `platformController.connect`
-> `platformService.connect`
-> `platformRepository.upsertAccount`
-> `syncService.syncPlatformAccount`
-> platform client (`codeforcesClient`, `codechefClient`, or extension-owned LeetCode ingestion)
-> `platform_accounts`, `submission_history`, and `contest_history`
-> analytics/profile cache invalidation
-> account response and frontend reload.

Connection and its initial sync run in one PostgreSQL transaction. A failed initial sync rolls the account change back. LeetCode is the exception: connection persists a `pending_extension_upload` state and the browser extension owns its authenticated data ingestion.

## Platform Resynchronization

`script/platforms.js`
-> `POST /api/platforms/sync/:platform`
-> `platformController.syncAccount`
-> `platformService.sync`
-> `syncService.syncPlatformAccount`
-> platform client
-> normalized profile/contest/submission snapshot
-> `platform_accounts`, `submission_history`, and `contest_history`
-> `analytics_cache` deletion and Redis `analytics:<user>:*` deletion
-> frontend account reload.

Sync state is stored in `platform_accounts.sync_status`; stage details and partial-source warnings are stored in `platform_accounts.metadata`. A partial source must preserve the last valid unavailable dataset instead of replacing it with an empty array.

## Analytics

`pages/analytics.html` or `pages/dashboard.html`
-> `script/services/analyticsService.js`
-> `GET /api/analytics/:platform` or `GET /api/analytics/combined`
-> `analyticsController`
-> `analyticsService`
-> Redis computed cache
-> `analyticsRepository.getFreshCache`
-> `platform_accounts`, `submission_history`, and `contest_history`
-> normalized analytics payload
-> `analyticsRepository.upsertCache`
-> frontend renderer.

Authoritative metric definitions belong to `backend/src/services/analyticsService.js`. Frontend code selects a platform and renders the returned contract. It must not call platform APIs directly or synthesize submissions to recreate missing backend facts.

Computed cache keys are:

- Redis: `analytics:<userId>:<platform|combined>:<window>`
- PostgreSQL: `analytics:<platform|combined>` plus `window_key`

Every computed payload carries `analyticsVersion`. Both Redis and PostgreSQL cache reads must reject a mismatched version. Platform sync and account connect/disconnect invalidate all analytics cache entries for the affected user.

## Dashboard

`pages/dashboard.html`
-> `stateManager.loadPlatforms`
-> selected connected platform set
-> `stateManager.loadAnalytics`
-> backend platform or combined analytics endpoint
-> `script/dashboard.js`
-> rating chart, activity heatmap, KPI values, contest table, and recent submissions.

Each rating point carries its `platform`, external contest identity, rating-after value, delta, rank, and participation timestamp. Combined mode preserves platform identity and sorts points by timestamp; it does not merge contests by display name.

## AI Conversation

`pages/ai-coach.html`
-> bundled `src/apps/ai-coach/main.jsx`
-> `AiCoachWorkspaceProvider`
-> `src/features/ai-coach/api/aiCoachApi.js`
-> `/api/ai/conversations`
-> `conversationController`
-> `conversationService`
-> `conversationRepository`
-> `ai_conversations` and `ai_conversation_messages`.

The canonical lifecycle is create conversation, persist user message, generate, persist completed coach message, reload the conversation. PostgreSQL IDs and per-conversation `message_order` define identity and ordering. Local storage stores the last selected conversation and a recovery copy only; it is not authoritative.

## AI Generation

Question submission
-> planner classification and retrieval plan
-> evidence retrieval
-> reasoning context
-> prompt package
-> execution plan
-> `POST /api/ai/runtime/execute`
-> `LLMRuntimeEngine`
-> configured provider (currently Gemini)
-> runtime result persistence in `llm_requests` and `runtime_metrics`
-> quality validation
-> `validated_responses`
-> completed coach message persistence
-> frontend transcript.

The shared AI API client owns access-token refresh and request retry. Conversation refresh must not replace an active streaming/completed local message with an older server transcript.

## Confirmed Competing Logic

- `script/analytics.js` directly calls Codeforces and synthesizes fake submission-shaped rows when backend fields appear incomplete. This masks cache/schema and contract failures.
- `script/services/analyticsService.js` can merge selected platform analytics independently of the backend combined endpoint. The formulas must match the backend or be removed.
- AI local-session backup currently participates in boot selection. Server conversations must load on every authenticated boot and supersede recovery data when available.

## Confirmed Failure Boundaries

- Resync persistence is not atomic when `syncService` uses the pool directly; profile status can update before history replacement finishes.
- A partial CodeChef activity fetch is represented as `submissions: []`; the current persistence path can delete the previous valid history.
- Platform analytics cache reads accept old payload versions, so bumping `analyticsVersion` does not invalidate platform caches.
- Analytics-page intelligence is recomputed from only the recent-submission slice and can display empty metrics despite complete stored history.
- AI boot skips server conversation loading whenever `initialState` is supplied; the application always supplies it.
- User and queued coach messages are persisted concurrently and can receive the same `message_order`.
