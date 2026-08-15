# CPInsight Stabilization Verification

## Runtime baseline

- API: `http://127.0.0.1:4000`, health 200, ready 200.
- Frontend: `http://127.0.0.1:5500`, key pages and generated bundles return 200.
- PostgreSQL 16 and Redis 7 are running through the normal backend Compose workflow.
- Migration `020_ai_conversation_message_order.sql` is applied.

## Database and API consistency

| Platform | Database submissions | API submissions | Accepted | Solved | Contests | Rating points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codeforces | 177 | 177 | 101 | 100 | 12 | 12 |
| CodeChef | 240 | 240 | 136 | 126 | 7 | 7 |
| LeetCode | 101 | 101 | 101 | 101 | 0 | 0 |
| Combined | 518 | 518 | 338 | 327 | 19 | 19 |

Combined rating progression contains distinct `codeforces` and `codechef` series. Combined analytics contains 49 topics, 201 difficulty samples, and 81 active days. CodeChef has no topic/difficulty metadata from its current upstream surface; those datasets are explicitly unavailable rather than fabricated.

## Cache verification

1. Requested Codeforces analytics and confirmed payload version 5.
2. Ran a real Codeforces sync.
3. Queried `analytics_cache`: affected Codeforces/combined cache rows were zero immediately after sync.
4. Requested analytics again and received fresh version 5 with 177 submissions, 12 rating points, and 19 topics.

## AI verification

- Concurrent conversation test: six writes, six persisted messages, six unique client IDs, zero duplicate `(conversation_id, message_order)` rows.
- General question: Gemini `gemini-flash-latest` generated a substantive binary-search answer.
- Personal question: Gemini used 82 retrieved evidence items from available CPInsight context.
- Reloaded transcript: four completed messages in `user, coach, user, coach` order.
- Conversation was discoverable through get, list, and search before test cleanup.
- Recent `llm_requests`: two `completed` rows for Gemini.

## Authentication verification

A temporary runtime user exercised register, login, refresh rotation, protected profile access, logout, and revoked-token rejection. The temporary user was deleted after verification.

## Regression endpoints

- Calendar contests: 200.
- Platform accounts: 200, three accounts.
- Combined analytics: 200.
- Review jobs: 200.
- Behavior profile/features: 200.
- AI runtime health: 200.
- AI conversations: 200.
- Latest review: truthful 404 because no completed review exists.

## Build and tests

- `npm run build:frontend`: PASS. Vite reports a visualization bundle size warning, not a build failure.
- `backend/npm test`: PASS. Syntax checked 246 files; five analytics/conversation contract tests passed.
- AI workspace verifier: PASS.
- AI design-system verifier: PASS.

## Browser limitation

The in-app browser binding is stuck on its earlier network-error document and its control policy rejects localhost navigation/reload. No connected Chrome browser extension is available. Therefore browser console, visual chart rendering, click-based conversation switching, close/reopen, and streaming presentation are not claimed as verified.

## CodeChef resilience

Earlier CodeChef recent-activity requests returned HTTP 429 after throttled retries. CPInsight reported `partial`, preserved the verified 240-submission snapshot, and kept profile/contest data. The final retry completed all stages and the account is now `synced`.
