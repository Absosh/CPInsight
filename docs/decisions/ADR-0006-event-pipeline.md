# ADR-0006 Event Pipeline

## Status
Accepted

## Date
2026-07-22

## Context

Telemetry events need validation, deduplication, possible enrichment, persistence, and transport. Putting all of this directly in the Event Bus would make future changes invasive.

## Decision

An `EventPipeline` processes events before persistence and transport. It normalizes event shape, validates schema, executes middleware, checks store-backed deduplication, and freezes emitted events.

## Consequences

Positive:

- New cross-cutting behavior can be added as middleware.
- Event Bus stays focused on dispatch.
- Deduplication is separated from event identity.

Negative:

- Middleware order becomes important.
- Middleware must not introduce platform-specific branching into the SDK.

## Alternatives Considered

- EventBus-only processing: rejected because validation, enrichment, dedupe, and future policy hooks would accumulate in one class.
- Collector-side validation: rejected because collectors should only understand platform page structure.
- Backend-only validation: rejected because local durability should store valid events.

## Related Components

- Event Pipeline
- Event Bus
- Schema Validator
- Persistent Store

## References

- [Observability SDK](../architecture/observability-sdk.md)
