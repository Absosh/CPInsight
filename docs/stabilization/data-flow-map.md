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

## Removed Competing Logic

- `script/analytics.js` no longer calls Codeforces directly or synthesizes submission-shaped rows. It renders the versioned backend contract.
- `script/services/analyticsService.js` preserves platform identity when it merges an explicitly selected subset for the dashboard. The backend owns metric formulas.
- AI local-session backup is recovery-only. A successful server list/get response is authoritative on every authenticated boot.

## Stabilized Failure Boundaries

- Resync writes now use one transaction; profile/history changes commit together.
- A partial CodeChef activity fetch is explicitly unavailable and preserves the last valid submission snapshot.
- Redis and PostgreSQL analytics cache reads reject payloads whose `analyticsVersion` is not current.
- Analytics intelligence uses complete stored history in the backend rather than the recent-submission slice.
- AI boot always loads server conversations, even when URL-derived initial UI state is supplied.
- Message append locks the conversation row and a unique database index enforces one `message_order` per conversation.

## Avatar Storage

`POST /api/user/profile/avatar`
-> `avatarService.storeAvatar`
-> `/app/uploads/avatars`
-> persistent Docker volume/bind mount
-> avatar URL in `user_profiles`
-> `GET /uploads/avatars/<file>`.

Profile hydration verifies local avatar existence. A missing local file clears its dangling database reference and profile cache instead of repeatedly returning a broken URL.
