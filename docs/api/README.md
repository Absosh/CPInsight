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
| `POST` | `/api/behavior/extract` | Yes | Run behavior reconstruction and feature extraction |
| `GET` | `/api/behavior/sessions` | Yes | List reconstructed behavior sessions |
| `GET` | `/api/behavior/profile` | Yes | Latest behavior profile |
| `GET` | `/api/behavior/features` | Yes | Behavior feature rows |
| `GET` | `/api/behavior/trends` | Yes | Historical feature trends |
| `GET` | `/api/debug/submissions/:platform` | Yes | Debug submission inspection |
| `GET` | `/api/debug/user-accounts` | Yes | Debug account inspection |

Debug endpoints are implemented and authenticated, but should not be treated as stable product APIs.

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
