# Operations Handbook

This handbook describes how to build, run, deploy, monitor, and recover CPInsight. It complements the architectural documents under [architecture](architecture/system-overview.md) and does not redefine system design.

## Prerequisites

| Requirement | Version or Notes |
| --- | --- |
| Operating system | Linux, macOS, or Windows with PowerShell. Docker-based workflows are preferred for parity. |
| Node.js | `>=20`, matching `backend/package.json` and `backend/Dockerfile`. |
| Package manager | npm. The backend and extension have separate `package-lock.json` files. |
| Docker | Required for the documented PostgreSQL, Redis, API, and frontend Compose workflow. |
| Chrome or Chromium | Required to load and test the extension. |
| PostgreSQL | PostgreSQL 16 in Docker Compose. |
| Redis | Redis 7 in Docker Compose. |

There is no root `package.json`. Run npm commands from `backend/` or `extension/`.

## Repository Setup

```powershell
git clone <repository-url>
cd CP-INSIGHT
cd backend
npm ci
cd ..\extension
npm ci
```

On Linux or macOS, use `/` path separators.

## Environment Setup

The Docker Compose deployment uses `.env.deploy` by default. That file is ignored by Git.

Required backend variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the API and migration runner. |
| `REDIS_URL` | Redis connection string used by cache helpers. |
| `JWT_ACCESS_SECRET` | JWT signing secret for access tokens. Must be at least 32 characters. |
| `JWT_REFRESH_SECRET` | JWT signing secret for refresh tokens. Must be at least 32 characters. |
| `POSTGRES_PASSWORD` | Password for the Docker Compose PostgreSQL service. |

Optional backend variables:

| Variable | Default |
| --- | --- |
| `NODE_ENV` | `development` |
| `PORT` | `4000` |
| `API_BASE_URL` | `http://localhost:4000` |
| `FRONTEND_ORIGIN` | empty |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL_DAYS` | `30` |
| `BCRYPT_ROUNDS` | `12` |
| `CODEFORCES_API_BASE` | `https://codeforces.com/api` |
| `LEETCODE_GRAPHQL_ENDPOINT` | `https://leetcode.com/graphql` |
| `CODECHEF_BASE_URL` | `https://www.codechef.com` |
| `OUTBOX_RELAY_ENABLED` | `true` |
| `OUTBOX_RELAY_BATCH_SIZE` | `100` |
| `OUTBOX_RELAY_LEASE_MS` | `30000` |
| `OUTBOX_RELAY_POLL_INTERVAL_MS` | `1000` |
| `OUTBOX_RELAY_MAX_ATTEMPTS` | `5` |
| `REDIS_EVENT_DISTRIBUTION_ENABLED` | `true` |
| `REDIS_EVENT_STREAM_MAX_LENGTH` | `1000000` |
| `REALTIME_GATEWAY_ENABLED` | `true` |
| `REALTIME_GATEWAY_PATH` | `/realtime` |
| `REALTIME_GATEWAY_GROUP` | `websocket-gateway` |
| `REALTIME_GATEWAY_MAX_QUEUE_SIZE` | `1000` |
| `REALTIME_GATEWAY_IDLE_TIMEOUT_MS` | `60000` |
| `REALTIME_GATEWAY_BATCH_SIZE` | `100` |

## Local Infrastructure Startup

Start PostgreSQL and Redis through Docker Compose:

```powershell
docker compose up -d postgres redis
```

Verify dependency health:

```powershell
docker compose ps
```

## Database Migrations

Run migrations before starting the API against a fresh or changed database:

```powershell
docker compose --profile tools run --rm migrate
```

Backend-only alternative:

```powershell
cd backend
npm run migrate
```

The backend-only path requires `DATABASE_URL` to be present in the shell environment.

## Backend Startup

Development:

```powershell
cd backend
npm run dev
```

Production-style local start:

```powershell
cd backend
npm start
```

Docker Compose:

```powershell
docker compose up -d api
```

Health checks:

```powershell
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

## Frontend Startup

The frontend is static HTML, CSS, and browser JavaScript. Production-style Docker startup:

```powershell
docker compose up -d frontend
```

The Docker frontend serves through Nginx on port `8080`.

For local static development, serve the repository root with any static file server and open pages under `pages/`. The repository does not currently define a frontend npm dev server.

## Chrome Extension Loading

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the `extension/` directory.
5. Inspect the service worker from the extension details page when debugging background behavior.

The extension architecture is documented in [Chrome Extension Architecture](architecture/chrome-extension.md).

## Development Workflow

1. Start PostgreSQL and Redis.
2. Run migrations.
3. Start the backend.
4. Serve or open the frontend.
5. Load the extension unpacked when extension changes are involved.
6. Run the tests documented in [Testing](TESTING.md).
7. Update docs when public behavior, architecture, operations, or security assumptions change.

## Production Deployment Order

1. Build images.
2. Start PostgreSQL and Redis.
3. Run migrations.
4. Start the API.
5. Verify `/health` and `/ready`.
6. Start the frontend.
7. Validate login, analytics, and extension upload paths.
8. Monitor logs and error rates after deployment.

## Monitoring

Implemented observability is currently log-based and health-check based.

Monitor:

- API process health: `/health`.
- Dependency readiness: `/ready`.
- Docker container health.
- PostgreSQL disk usage and connection count.
- Redis memory usage and eviction behavior.
- API logs from Morgan and the global error handler.
- Extension service worker console logs when debugging local extension behavior.

Future telemetry ingestion and live dashboards are described in [Future Roadmap](architecture/future-roadmap.md).

## Logs

| Component | Where to inspect |
| --- | --- |
| API | `docker compose logs api` or terminal running `npm start`. |
| PostgreSQL | `docker compose logs postgres`. |
| Redis | `docker compose logs redis`. |
| Frontend Nginx | `docker compose logs frontend`. |
| Extension background | Chrome extension service worker console. |
| Extension content script | Target page DevTools console. |

## Recovery Procedures

### API Fails to Start

1. Check environment validation errors.
2. Verify `DATABASE_URL` and `REDIS_URL`.
3. Confirm PostgreSQL and Redis health.
4. Run migrations.
5. Inspect API logs.

### Migrations Fail

1. Stop dependent API deployments.
2. Inspect the migration error.
3. Verify migration order in [Database Migrations](database/migrations.md).
4. Restore from backup if a partially applied migration caused data inconsistency.
5. Re-run migrations only after the root cause is understood.

### Redis Data Loss

Redis stores cache data. PostgreSQL is canonical. Restart Redis and allow backend services to recompute analytics cache.

### PostgreSQL Data Loss

PostgreSQL is canonical. Restore the latest verified backup before starting API traffic. Re-run migrations only after restore compatibility is confirmed.

### Outbox Relay Backlog

The outbox relay persists pending domain events in PostgreSQL. If the queue grows:

1. Check API logs for relay publish failures.
2. Inspect `domain_event_outbox` grouped by `status`.
3. Confirm `OUTBOX_RELAY_ENABLED=true`.
4. Check rows in `dead_letter` status and inspect `retry_history`.
5. Increase `OUTBOX_RELAY_BATCH_SIZE` only after confirming PostgreSQL has capacity.

### Redis Event Stream Backlog

Redis Streams distribute domain events to workers. If stream lag grows:

1. Inspect stream lengths for `cpinsight:v1:*`.
2. Inspect consumer-group pending entries.
3. Check dead-letter streams ending in `.dead-letter`.
4. Verify Redis connectivity and `REDIS_EVENT_DISTRIBUTION_ENABLED`.
5. Scale consumers within the affected consumer group.

### WebSocket Gateway Issues

The gateway consumes Redis Streams and serves `/realtime` by default. If clients do not receive messages:

1. Verify the access token used during WebSocket upgrade.
2. Check Redis stream lag for the `websocket-gateway` consumer group.
3. Inspect gateway logs for unauthorized channel subscriptions.
4. Check dropped message and heartbeat failure metrics.
5. Confirm the load balancer supports WebSocket upgrades.

### Behavior Extraction Backlog

Behavior extraction reads accepted telemetry and writes immutable feature rows. If extraction slows:

1. Check `feature_extraction_metrics` for latency and failures.
2. Limit extraction windows for backfills.
3. Inspect confidence distributions for low-signal telemetry.
4. Run `node scripts/verify-behavior-intelligence.js`.
5. Add future workers before running large career-wide recomputations continuously.

### Extension Session Corruption

The Observability SDK validates local storage shapes and resets corrupted observability keys to safe defaults. If local extension behavior remains inconsistent, remove extension storage from Chrome and reload the unpacked extension.

## Common Operational Issues

| Symptom | Likely Cause | Action |
| --- | --- | --- |
| `Invalid environment` on API start | Missing or invalid env var | Check `.env.deploy` and `backend/src/config/env.js`. |
| `401 Missing bearer token` | Missing `Authorization` header | Reauthenticate client or refresh token. |
| LeetCode upload returns `409` | Account mismatch, disconnected account, or unsupported collector version | Verify connected LeetCode handle and extension version. |
| Analytics returns outdated data | Redis/PostgreSQL analytics cache | Trigger platform sync or clear user analytics cache through service logic. |
| Domain events are not reaching subscribers | Outbox relay disabled, stuck lease, or repeated subscriber failure | Inspect `domain_event_outbox`, `domain_event_subscriber_failures`, and relay environment variables. |
| Redis consumers stop progressing | Consumer crash, pending entries, or poison message | Check Redis pending entries, dead-letter streams, and worker logs. |
| WebSocket clients disconnect under load | Slow client or full outbound queue | Inspect dropped message metrics and increase `REALTIME_GATEWAY_MAX_QUEUE_SIZE` only after checking client behavior. |
| Behavior profile is empty | Extraction has not run or telemetry is missing | Run `/api/behavior/extract` and inspect `feature_extraction_metrics`. |
| Extension collector does not run | Host permission or content script match issue | Check `extension/manifest.json` and service worker console. |
| Duplicate contest tabs behave unexpectedly | Local extension state issue | Inspect `observability.sessions` and `observability.tabIndex` in Chrome storage. |

## Disaster Recovery Checklist

- Confirm incident start time and affected components.
- Stop write traffic if PostgreSQL consistency is at risk.
- Preserve logs from API, PostgreSQL, Redis, and deployment system.
- Verify latest database backup integrity.
- Restore PostgreSQL to a known-good point.
- Run migrations compatible with the restored version.
- Restart Redis; allow cache warmup.
- Restart API and frontend.
- Verify auth, profile, platform sync, analytics, extension upload, telemetry ingestion, and outbox relay smoke tests.
- Document incident cause, recovery steps, and follow-up fixes.

## Related Documentation

- [Deployment Architecture](architecture/deployment.md)
- [Database Migrations](database/migrations.md)
- [Testing](TESTING.md)
- [Security](SECURITY.md)
- [Transactional Outbox](architecture/transactional-outbox.md)
- [Redis Event Distribution](architecture/redis-event-distribution.md)
- [WebSocket Gateway](architecture/websocket-gateway.md)
- [Behavior Intelligence](architecture/behavior-intelligence.md)
- [Feature Extraction](architecture/feature-extraction.md)
- [API Reference](api/README.md)
