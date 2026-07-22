# Analytics API

Analytics routes are defined in `backend/src/routes/analyticsRoutes.js`. All analytics endpoints require bearer authentication and use analytics rate limiting.

## Combined Analytics

```http
GET /api/analytics/combined
Authorization: Bearer <accessToken>
```

Returns a combined payload across connected Codeforces, CodeChef, and LeetCode accounts.

Response fields include:

- `solvedProblems`
- `solvedLastYear`
- `solvedLastMonth`
- `contestCount`
- `submissions`
- `activityHeatmap`
- `topicStrength`
- `ratingProgression`
- `streak`
- `recentSubmissions`
- `cpInsightScore`
- `analyticsVersion`
- `platforms`

## Platform Analytics

```http
GET /api/analytics/:platform
Authorization: Bearer <accessToken>
```

Supported route platforms:

- `codeforces`
- `codechef`
- `leetcode`

Example:

```http
GET /api/analytics/codeforces
```

Errors:

- `404`: no connected account for the platform.
- `409`: LeetCode accepted submission history is incomplete or not extension verified for solved metrics.

## Compare User

```http
GET /api/analytics/compare/:username
Authorization: Bearer <accessToken>
```

Compares the current user with another username using backend analytics logic.

## Caching

Redis cache keys are used for platform and combined analytics where safe. PostgreSQL `analytics_cache` stores persisted computed payloads. LeetCode cache use is restricted because extension uploads can replace local facts.
