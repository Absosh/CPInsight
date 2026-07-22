# ADR-0010 UUID Event Identity

## Status
Accepted

## Date
2026-07-22

## Context

Telemetry systems need globally unique event identity and separate idempotency semantics. Deterministic event IDs are useful for deduplication but weak as distributed event identity because repeated observations collapse into the same identifier.

## Decision

Events receive UUID identity when emitted. Deduplication uses a separate `metadata.dedupeKey` checked by the persistence layer.

## Consequences

Positive:

- Event identity remains globally unique.
- Replay safety and deduplication are independent concerns.
- Backend ingestion can use event id and dedupe key differently.

Negative:

- Duplicate checks require reading stored event metadata.
- Dedupe-key design must remain stable for semantically duplicate events.

## Alternatives Considered

- Deterministic event IDs only: rejected because identity and idempotency become conflated.
- Random IDs only without dedupe keys: rejected because duplicate page-load events would be stored repeatedly.
- Sequential counters: rejected because counters are hard to coordinate across restarts and clients.

## Related Components

- Event Pipeline
- Persistent Store
- Schema Validator

## References

- [Telemetry](../architecture/telemetry.md)
