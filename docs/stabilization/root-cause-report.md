# CPInsight Root-Cause Report

## 1. Platform synchronization

**Problem:** Connected accounts could report success while downstream history was stale, partial, or deleted.

**Root cause:** Resync persistence used independent pool operations; account state could commit before history replacement. Unavailable CodeChef recent activity was normalized as an empty array, so a partial upstream response could erase a valid snapshot. CodeChef dates were also parsed as month/day instead of day/month.

**Affected layers:** Platform clients, sync service, PostgreSQL histories, analytics invalidation, platform UI status.

**Fix:** Fetches are staged, writes are transactional, availability is explicit, partial sync preserves unavailable datasets, status metadata records stage/warnings, invalid dates are rejected, and CodeChef requests use throttled retries plus page caching.

**Why previous fixes failed:** They handled errors after normalization had already made unavailable data indistinguishable from a valid empty result.

**Verification:** Real Codeforces sync stored 177 submissions and 12 contests. The final CodeChef sync completed all profile, contest, submission, and activity stages and stored 240 submissions and 7 contests. Earlier HTTP 429 responses produced `partial` without changing the valid 240-row snapshot. No future-dated CodeChef rows remain.

**Regression result:** Codeforces PASS. CodeChef PASS.

## 2. Analytics and dashboard

**Problem:** Analytics rendered empty despite synchronized data; combined topic metrics and non-Codeforces rating points were lost or misread.

**Root cause:** The analytics page recomputed full-history metrics from only 20 recent accepted submissions, then synthesized fake rows or called Codeforces directly. Combined analytics rebuilt every topic from one artificial accepted row. Per-platform caches accepted old schemas. Dashboard chart parsing assumed one numeric/date shape.

**Affected layers:** Analytics service/cache, frontend service, analytics page, dashboard rating visualization.

**Fix:** Analytics payload version 5 owns complete-history topic, activity, difficulty, and contest intelligence. Combined aggregation preserves attempts, accepted counts, solved counts, weighted difficulty, and platform-tagged rating points. All cache reads enforce the version. Direct upstream fallback and synthetic rows were removed. Dashboard normalization preserves platform and contest identity.

**Why previous fixes failed:** They compensated in the renderer instead of repairing the database-to-API contract.

**Verification:** PostgreSQL and HTTP API both report 177 Codeforces and 240 CodeChef submissions. Combined API reports 518 submissions, 338 accepted, 327 solved, 19 contests, and 19 rating points across Codeforces and CodeChef. Contract tests cover formulas; a real selected-platform frontend merge retained both rating series.

**Regression result:** API/data contract PASS. Visual browser confirmation remains unavailable in the automated browser environment.

## 3. AI generation and history

**Problem:** AI history reset whenever the page opened, message ordering could collide, and persistence failures were silently ignored.

**Root cause:** The app always supplied `initialState`, while provider effects skipped server hydration whenever that prop existed. User and queued coach messages were written concurrently using `MAX(message_order)+1`. Local backup could replace an empty successful server result. Best-effort persistence swallowed failures.

**Affected layers:** React boot/hydration, API client lifecycle, conversation repository, PostgreSQL message ordering.

**Fix:** Server list/get runs on every boot and supersedes recovery state. Local backup is used only when the server request fails. Conversation creation and message writes are server-first and sequential. Message append locks the conversation row in a transaction; migration 020 normalizes old order values and adds a unique order index.

**Why previous fixes failed:** LocalStorage masked the skipped hydration effect while concurrent writes left the durable transcript nondeterministic.

**Verification:** Six concurrent API writes persisted with six unique client IDs and zero duplicate orders. Two real Gemini generations persisted four completed user/coach messages; list, get, and search all reloaded the same conversation. The database recorded two completed Gemini runtime requests.

**Regression result:** Server persistence and generation PASS. Real browser close/reopen and stream interaction remain unverified because browser control cannot reach localhost.

## 4. Avatar persistence

**Problem:** Container rebuilds removed uploaded avatars while the database kept their URLs, causing repeated 404 responses.

**Root cause:** `/app/uploads` was inside the disposable API container filesystem.

**Affected layers:** Profile service, Docker runtime, static upload route.

**Fix:** Local development bind-mounts `backend/uploads`; deployment uses a named uploads volume; the image seeds the directory; profile hydration removes dangling local references.

**Verification:** A real avatar upload returned 200 before and after API container recreation. The existing missing avatar reference self-healed to null.

**Regression result:** PASS.
