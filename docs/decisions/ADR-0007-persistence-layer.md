# ADR-0007 Persistence Layer

## Status
Accepted

## Date
2026-07-22

## Context

The extension must recover from page refresh, browser restart, extension service worker suspension, duplicate tabs, and offline mode. Chrome Manifest V3 service workers are transient, so in-memory state is insufficient.

## Decision

The Observability SDK uses a `PersistentStore` over Chrome storage. It stores sessions, events, queue, tab index, and metadata. It validates stored shapes, records schema version metadata, and serializes write operations to reduce lost updates.

## Consequences

Positive:

- Unfinished sessions can be recovered.
- Events remain queued while offline.
- Corrupted storage shapes recover to safe defaults.

Negative:

- Chrome storage is not a high-throughput event database.
- Large-scale event retention will require backend ingestion and pruning policy.

## Alternatives Considered

- In-memory store: rejected because service workers and browser crashes lose state.
- Collector-owned storage: rejected because duplicate prevention and recovery would fragment.
- Immediate backend-only persistence: rejected because offline mode and unauthenticated transport failures must be tolerated.

## Related Components

- Persistent Store
- Session Engine
- Queued Transport

## References

- [Chrome Extension](../architecture/chrome-extension.md)
- [Telemetry](../architecture/telemetry.md)
