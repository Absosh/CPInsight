# Submission Diff Engine

The extension-side Submission Diff Engine compares Codeforces API snapshots and emits only new telemetry events.

## Inputs

- Previous `user.status` submissions.
- Current `user.status` submissions.
- Previous standings row.
- Current standings row.

## Outputs

Event examples:

- `SUBMISSION_CREATED`
- `SUBMISSION_VERDICT`
- `ACCEPTED`
- `WRONG_ANSWER`
- `TIME_LIMIT`
- `RUNTIME_ERROR`
- `COMPILATION_ERROR`
- `PROBLEM_SOLVED`
- `RANK_CHANGED`

## Deduplication

Each generated event carries a deterministic metadata `dedupeKey`, such as:

```text
submission-verdict:{submissionId}:{verdict}
problem-solved:{contestId}-{problemIndex}
```

The extension queue suppresses duplicate queued keys and the backend telemetry pipeline enforces UUID event idempotency.

## API Boundary

The diff engine does not scrape HTML and does not infer behavior. It converts official Codeforces API changes into telemetry events.
