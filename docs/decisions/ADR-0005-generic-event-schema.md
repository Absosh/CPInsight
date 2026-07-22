# ADR-0005 Generic Event Schema

## Status
Accepted

## Date
2026-07-22

## Context

Telemetry events must be comparable across platforms and future clients. Platform-specific event names or fields would leak collector details into analytics, transport, and backend storage.

## Decision

All collectors emit through one event schema with common fields: event id, session id, user id, platform, contest id, contest name, problem id, event type, timestamp, page URL, and metadata.

Platform-specific details may be placed in metadata only when necessary.

## Consequences

Positive:

- Event consumers can process every platform uniformly.
- Backend ingestion can validate one schema.
- Analytics can remain platform-agnostic where possible.

Negative:

- Metadata must be governed to avoid becoming an unstructured dumping ground.
- Some platform concepts may require careful normalization into generic fields.

## Alternatives Considered

- Platform-specific schemas: rejected because consumers would need platform branches.
- Fully untyped JSON events: rejected because schema validation and long-term compatibility would be weak.
- Analytics-specific events only: rejected because raw session reconstruction requires lifecycle-level events.

## Related Components

- Schema Validator
- Event Pipeline
- Event Bus

## References

- [Telemetry](../architecture/telemetry.md)
- [Telemetry API](../api/telemetry-api.md)
