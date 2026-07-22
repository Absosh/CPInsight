# Backend Architecture

The backend is an Express application under `backend/src`. It follows a route-controller-service-repository structure.

## Layering

```mermaid
flowchart LR
  Routes["Routes"] --> Middleware["Validation, auth,\nrate limits"]
  Middleware --> Controllers["Controllers"]
  Controllers --> Services["Services"]
  Services --> Repositories["Repositories"]
  Repositories --> PostgreSQL["PostgreSQL"]
  Services --> Redis["Redis"]
  Services --> PlatformClients["Platform clients"]
```

## Module Responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes | `backend/src/routes` | Bind HTTP method/path to middleware and controller |
| Middleware | `backend/src/middleware` | Authentication, Joi validation, rate limits, error handling |
| Controllers | `backend/src/controllers` | Convert HTTP request/response to service calls |
| Services | `backend/src/services` | Business logic and orchestration |
| Repositories | `backend/src/repositories` | SQL access and persistence operations |
| Database | `backend/src/database` | Pool and migration runner |
| Redis | `backend/src/redis` | Cache read/write helpers |

## Implemented Domains

### Authentication

`authService` handles registration, login, refresh-token rotation, and logout. It hashes passwords with bcrypt and issues JWT access and refresh tokens. Refresh tokens are persisted by hash in PostgreSQL.

### User Profile

`userService` and `userRepository` manage profile fields, college search, and avatar metadata. Avatar files are served under `/uploads`.

### Platform Accounts

`platformService` connects and synchronizes platform accounts. Platform-specific clients live under `backend/src/services/platforms`.

### Analytics

`analyticsService` computes platform and combined analytics from persisted facts. Redis and PostgreSQL cache are used for some analytics paths. LeetCode is treated more conservatively because extension-verified data may change local facts.

### Extension Uploads

`extensionUploadService` validates authenticated LeetCode extension payloads, verifies collector version and account ownership, persists upload records, replaces LeetCode submission facts, and invalidates analytics cache.

### Telemetry Ingestion

`telemetryService` accepts authenticated Observability SDK upload batches and delegates telemetry semantics to the processing pipeline. The pipeline validates schema version, timestamp sanity, ordering, and idempotency; enriches and classifies events; stores raw events and processed metadata; records metrics; and returns acknowledged event ids. It does not compute analytics.

## Error Handling

Controllers are wrapped with `asyncHandler`. Domain errors use `HttpError`. The global error handler serializes errors into HTTP responses. Validation uses Joi schemas and rejects invalid request shapes before service execution.

## Background Jobs

`backend/src/jobs/syncPlatformsJob.js` exists for platform synchronization work. The current architecture keeps jobs in the backend because they operate on persisted platform accounts and database facts.

## Security Boundaries

- Authentication middleware verifies bearer JWTs and loads the user from PostgreSQL.
- Password hashes are never returned.
- Refresh tokens are stored as SHA-256 hashes.
- Extension upload endpoints require the same bearer authentication model as the frontend.

See [Authentication](authentication.md) for token flow and threat model.
