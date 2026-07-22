# Telemetry and Extension API

This document covers implemented extension upload and Observability SDK telemetry ingestion APIs.

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

## Implemented: Observability SDK Telemetry Ingestion

```http
POST /api/telemetry/upload
Authorization: Bearer <accessToken>
Content-Type: application/json
Idempotency-Key: <batchId>
```

Request:

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceNumber": 1,
  "createdAt": "2026-07-22T12:00:00.000Z",
  "sdkVersion": "observability-sdk-v1",
  "schemaVersion": 1,
  "collectorVersion": "codeforces-contest-session",
  "events": [
    {
      "sequenceNumber": 1,
      "event": {
        "eventId": "550e8400-e29b-41d4-a716-446655440001",
        "sessionId": "contest_session_...",
        "userId": null,
        "platform": "codeforces",
        "contestId": "1999",
        "contestName": "Contest",
        "problemId": "A:A",
        "eventType": "PROBLEM_OPENED",
        "timestamp": "2026-07-22T12:00:00.000Z",
        "pageUrl": "https://codeforces.com/contest/1999/problem/A",
        "metadata": {}
      }
    }
  ]
}
```

Success: `202 Accepted`.

Response:

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "acknowledgedEventIds": [
    "550e8400-e29b-41d4-a716-446655440001"
  ],
  "highestSequenceNumber": 1,
  "serverTimestamp": "2026-07-22T12:00:01.000Z"
}
```

Validation:

- `batchId` and `event.eventId` must be UUIDs.
- `schemaVersion` must be supported by the backend.
- Events must be ordered by increasing `sequenceNumber`.
- Timestamps must be valid ISO timestamps and cannot be more than five minutes in the future.
- Page URLs must be HTTP or HTTPS URLs.

Errors:

- `400`: malformed payload, invalid timestamps, or invalid ordering.
- `401`: missing or invalid bearer token.
- `409`: unsupported schema version or event id conflict.
- `429`: rate limit response from middleware if configured for this route in the future.
- `500`: server-side ingestion failure.

Idempotency:

- Duplicate event ids already stored for the same user are acknowledged without inserting duplicate rows.
- Event ids already owned by another user are rejected with `409`.
- Batch ids are unique per user in `telemetry_batches`.
