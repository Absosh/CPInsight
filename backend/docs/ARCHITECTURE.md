# CPInsight Backend Architecture

## Architecture

CPInsight uses a modular Express backend:

- Controllers handle HTTP shape only.
- Services contain business rules and orchestration.
- Repositories own PostgreSQL queries.
- Platform clients isolate Codeforces, CodeChef, and LeetCode integration details.
- Redis caches profile reads, platform snapshots, and expensive analytics computations.
- Jobs will run sync pipelines for platform history and derived analytics.

Request flow:

`route -> validation -> auth/rate-limit middleware -> controller -> service -> repository/platform client/cache`

## PostgreSQL Schema

Tables:

- `users`: login identity and password hash.
- `user_profiles`: display/profile preferences, one-to-one with `users`.
- `platform_accounts`: one row per connected CP platform per user.
- `contest_history`: normalized contest participation across platforms.
- `submission_history`: normalized submissions across platforms.
- `analytics_cache`: persisted computed analytics by user/platform/window.
- `refresh_tokens`: hashed refresh tokens with rotation, revocation, device metadata.

Important relationships:

- `user_profiles.user_id -> users.id`
- `platform_accounts.user_id -> users.id`
- `contest_history.platform_account_id -> platform_accounts.id`
- `submission_history.platform_account_id -> platform_accounts.id`
- `analytics_cache.user_id -> users.id`
- `refresh_tokens.user_id -> users.id`

Indexes:

- Case-insensitive unique indexes for `users.email` and `users.username`.
- Unique `platform_accounts(user_id, platform)`.
- Unique `platform_accounts(platform, handle_normalized)`.
- Platform/user/time indexes for contest and submission history.
- Partial active refresh-token index.

## Authentication Flow

Register:

1. Validate username, email, and password.
2. Hash password with bcrypt using `BCRYPT_ROUNDS`.
3. Insert `users` and default `user_profiles` in one transaction.
4. Issue short-lived JWT access token and long-lived refresh token.
5. Store only a SHA-256 hash of the refresh token.

Login:

1. Look up user by email.
2. Verify bcrypt password.
3. Revoke previous refresh token only if your product chooses single-session mode; default is multi-device.
4. Issue access and refresh tokens.

Refresh:

1. Verify refresh JWT signature.
2. Hash incoming token and find active DB record.
3. Revoke old token.
4. Issue rotated refresh token and new access token.

Logout:

1. Hash submitted refresh token.
2. Revoke matching DB record.
3. Client deletes local token/cookie.

## API Specification

### Auth

`POST /api/auth/register`

```json
{
  "username": "touristFan",
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

`POST /api/auth/refresh`

```json
{
  "refreshToken": "..."
}
```

`POST /api/auth/logout`

```json
{
  "refreshToken": "..."
}
```

### User

`GET /api/user/profile`

Returns `user`, `profile`, and connected platform accounts.

`PATCH /api/user/profile`

```json
{
  "displayName": "Aditi",
  "timezone": "Asia/Kolkata",
  "country": "IN"
}
```

### Platforms

`POST /api/platforms/connect`

```json
{
  "platform": "codeforces",
  "handle": "tourist"
}
```

`DELETE /api/platforms/disconnect`

```json
{
  "platform": "codeforces"
}
```

### Analytics

`GET /api/analytics/codeforces`

`GET /api/analytics/codechef`

`GET /api/analytics/leetcode`

`GET /api/analytics/combined`

Each endpoint returns cached analytics when fresh and refreshes from normalized history or upstream APIs when stale.

## Multi-Platform Strategy

Codeforces:

- Use official public API from the backend only.
- Sync handles with `user.info`, contests with `user.rating`, and submissions with `user.status`.
- Respect Codeforces limits with Redis rate-limit keys per IP and per handle.
- Cache upstream responses for 5 to 30 minutes depending on endpoint.

CodeChef:

- No official public API. Keep scraping isolated in `services/platforms/codechefClient.js`.
- Prefer scheduled sync over request-time scraping.
- Use polite headers, backoff, robots/legal review, HTML parser snapshots, and monitoring for layout changes.
- Store normalized contest and submission data after extraction so analytics never depend on live scraping.

LeetCode:

- Use GraphQL client isolated in `services/platforms/leetcodeClient.js`.
- Treat schema as unstable. Version queries and validate response shape.
- Prefer background sync and cache public profile, solved counts, badges, contest ranking, and recent submissions.
- Never require user credentials for scraping private LeetCode data.

## Redis Strategy

Keys:

- `profile:{userId}` TTL 10 minutes
- `platform-account:{userId}:{platform}` TTL 15 minutes
- `analytics:{userId}:{platform}:{window}` TTL 30 minutes
- `analytics:{userId}:combined:{window}` TTL 15 minutes
- `upstream:codeforces:user.info:{handle}` TTL 10 minutes
- `upstream:codeforces:user.status:{handle}` TTL 5 minutes
- `ratelimit:{scope}:{identifier}` TTL by limiter window
- `sync-lock:{platform}:{handle}` TTL 10 minutes

Abuse prevention:

- Global API limiter.
- Stricter auth limiter for login/register.
- Per-user analytics limiter.
- Sync locks to prevent stampedes.
- Serve stale `analytics_cache` when upstream systems degrade.

## Combined Analytics

Recommended metrics:

- Combined solved problems: distinct normalized problem keys by platform.
- Combined contest count: sum of normalized contests.
- Combined activity heatmap: daily accepted submissions across platforms.
- Combined topic strength: weighted accuracy and accepted count per tag/topic.
- Combined rating progression: platform-specific ratings normalized to percentile, then combined by recency.
- Combined streak: consecutive days with at least one accepted submission on any platform.

Unified CPInsight Score:

```text
score =
  0.30 * ratingPercentileScore +
  0.25 * problemSolvingScore +
  0.20 * consistencyScore +
  0.15 * contestParticipationScore +
  0.10 * topicBreadthScore
```

Use 0-100 normalized components. Apply recency weighting so current improvement matters more than stale peaks.

## Future AI Modules

Future modules should read normalized facts and derived analytics, not scrape live platforms:

- Weakness detection reads `submission_history`, tags, verdicts, and failed-to-accepted transitions.
- Contest review generator reads contest deltas, unsolved problems, and post-contest solves.
- Training plans read topic strength, rating target, schedule, and streak.
- Rating prediction reads normalized historical contests and recent practice volume.

Add them under `src/services/ai/` with repository interfaces instead of direct SQL in model prompts.

## Recommended Implementation Order

1. Configure PostgreSQL, Redis, environment validation, and health checks.
2. Run migrations for users, profiles, platform accounts, histories, caches, and refresh tokens.
3. Ship auth: register, login, refresh rotation, logout, protected route middleware.
4. Ship profile and platform account CRUD.
5. Implement Codeforces sync and analytics.
6. Add normalized analytics aggregation.
7. Add CodeChef and LeetCode background sync.
8. Add job queue, observability, and stale-cache fallbacks.
9. Wire frontend to backend APIs.
10. Add AI modules over normalized analytics.

## Production Readiness Checklist

- Use strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Store refresh tokens hashed, rotate on every refresh, revoke on logout.
- Enforce HTTPS and secure cookies in production.
- Use parameterized SQL only.
- Validate all request bodies with Joi.
- Enable Helmet, CORS allowlists, compression, and rate limiting.
- Add structured logs and request IDs.
- Add migrations to CI/CD.
- Run DB backups and Redis persistence.
- Add API tests for auth and platform-account workflows.
- Add background job retries with exponential backoff.
- Add uptime and upstream sync monitoring.
