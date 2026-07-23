# Contest Review Dead Letter Queue

The dead letter queue records contest review jobs that cannot complete after configured retries. A dead-lettered job is not silently discarded.

## Dead-Letter Criteria

A job enters `dead_letter` when `retry_count` reaches `REVIEW_WORKER_RETRY_LIMIT`. Common causes include:

- LLM provider outage beyond the retry window.
- Database write failures.
- Invalid persisted telemetry session state.
- Repeated retrieval, reasoning, or validation failures.

## Stored Data

`contest_review_dead_letters` stores:

- `job_id`
- `live_session_id`
- `user_id`
- `failure_reason`
- `stack_trace`
- `retry_count`
- `last_stage`
- serialized retry context
- creation timestamp

## Operational Handling

Operators should inspect the dead-letter record, confirm whether the cause is transient or permanent, and replay by creating a new review job only after the underlying issue is corrected. Dead-letter replay is intentionally administrative work; there is no public replay endpoint.

## Related Documents

- [Review Queue](review-queue.md)
- [Review Worker](review-worker.md)
- [Security Engineering](../SECURITY.md)
