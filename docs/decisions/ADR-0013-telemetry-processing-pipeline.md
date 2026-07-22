# ADR-0013 Telemetry Processing Pipeline

## Status
Accepted

## Date
2026-07-22

## Context

Phase 2.1 introduced reliable telemetry upload from the extension to the backend. The upload API could persist events directly, but that would make ingestion, validation, idempotency, enrichment, classification, future analytics, replay, and streaming compete for space inside the API handler.

Future systems need a single processing boundary that every uploaded event crosses before it is stored, analyzed, replayed, or streamed.

## Decision

Telemetry ingestion now uses a composable backend processing pipeline. Each stage implements the common lifecycle interface:

```text
initialize()
process(context)
flush()
shutdown()
```

The pipeline stages are:

- Schema Version.
- Authentication Context.
- Ordering Verification.
- Idempotency Check.
- Timestamp Normalization.
- Metadata Enrichment.
- Event Classification.
- Persistence.
- Acknowledgement.

The API route remains responsible for HTTP concerns, authentication middleware, and request validation. The pipeline owns telemetry processing semantics.

## Consequences

Positive:

- Upload API no longer contains telemetry business processing.
- Stages are independently testable and reorderable.
- Future stages such as PII detection, sampling, compression, feature extraction, or risk scoring can be inserted without rewriting existing stages.
- Raw and processed event persistence are separated.
- Future analytics and replay can consume processed telemetry metadata.

Negative:

- More backend modules exist than direct route-to-repository ingestion.
- Stage order is now an important operational contract.
- Pipeline metrics and dead-letter storage must be monitored once production traffic exists.

## Alternatives Considered

- Persist directly in `telemetryService`: rejected because it mixes upload orchestration with event processing logic.
- Process events asynchronously only after raw storage: rejected for Phase 2.2 because acknowledgement should reflect deterministic validation, idempotency, and ordering checks.
- Put processing in the extension: rejected because backend consumers need server-generated metadata, authenticated user context, and centralized idempotency.

## Related Components

- Telemetry API.
- Telemetry processing pipeline.
- Telemetry repository.
- Processed telemetry tables.
- Dead-letter storage.

## References

- [Telemetry Architecture](../architecture/telemetry.md)
- [Telemetry API](../api/telemetry-api.md)
- [Telemetry Flow](../sequence/telemetry-flow.md)
