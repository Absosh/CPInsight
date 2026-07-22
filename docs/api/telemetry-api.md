# Telemetry and Extension API

This document separates implemented extension upload APIs from planned Observability SDK telemetry ingestion.

## Implemented: LeetCode Extension Upload

```http
POST /api/extension/leetcode/collection
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Body shape is validated by `leetcodeCollectionSchema`.

Required top-level fields:

- `provider`: must be `leetcode`.
- `sessionId`
- `username`
- `metadata.collectorVersion`
- `metadata.payloadHash`
- `profile`
- `progress.questionDataset.questions`
- `progress.questionDataset.totalNum`
- `analytics`
- `collectionTimestamps.startedAt`
- `collectionTimestamps.mergedAt`
- `source`
- `upload.sessionId`
- `upload.collectorVersion`

Success:

- `201 Created` for accepted upload.
- `200 OK` for idempotent duplicate upload.

Example accepted response:

```json
{
  "status": "accepted",
  "uploaded": true,
  "sessionId": "leetcode-session-id",
  "handle": "alice",
  "questionsStored": 120
}
```

Duplicate response:

```json
{
  "status": "duplicate",
  "uploaded": false,
  "sessionId": "leetcode-session-id"
}
```

Errors:

- `400`: invalid payload or incomplete dataset.
- `409`: unsupported collector version, account mismatch, idempotency conflict, or disconnected LeetCode account.
- `401`: missing or invalid bearer token.

## Planned: Observability SDK Telemetry Ingestion

No backend endpoint currently accepts Observability SDK events. The SDK queues validated events locally in Chrome storage.

A future endpoint should accept batches of this schema:

```json
{
  "events": [
    {
      "eventId": "uuid",
      "sessionId": "contest_session_...",
      "userId": "uuid",
      "platform": "codeforces",
      "contestId": "1999",
      "contestName": "Contest",
      "problemId": "A:A",
      "eventType": "PROBLEM_OPENED",
      "timestamp": "2026-07-22T12:00:00.000Z",
      "pageUrl": "https://codeforces.com/contest/1999/problem/A",
      "metadata": {}
    }
  ]
}
```

The future endpoint should be authenticated, idempotent by event id, and separated from analytics derivation.
