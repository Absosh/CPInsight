# ADR-0001 Platform-Agnostic Observability SDK

## Status
Accepted

## Date
2026-07-22

## Context

CPInsight needs telemetry for contest sessions across Codeforces, CodeChef, LeetCode, AtCoder, HackerRank, HackerEarth, and future non-browser clients. A platform-specific telemetry implementation would couple URL parsing, DOM extraction, session state, persistence, upload, and analytics. That coupling would make each new platform a source-code modification to existing engine behavior.

The main constraints are Open/Closed Principle compliance, low extension overhead, crash recovery, and support for future transports and clients.

## Decision

Telemetry foundation is implemented as a generic Observability SDK under `extension/observability`. The SDK owns sessions, lifecycle transitions, events, validation, persistence, queueing, transport abstraction, and collector registration. It does not know platform hostnames, DOM selectors, or platform-specific URL shapes.

Platform-specific behavior is implemented outside the SDK as collector plugins.

## Consequences

Positive:

- New platforms can be added without modifying SDK lifecycle and event code.
- Collectors remain small and isolated.
- Session recovery and deduplication are reused by every collector.
- Future browser, desktop, editor, and mobile clients can reuse the same architectural contract.

Negative:

- The initial architecture has more modules than a platform-specific implementation.
- Collector authors must learn the SDK contract.
- Generic event schema requires careful metadata governance.

## Alternatives Considered

- Platform-specific telemetry engines: rejected because duplicated lifecycle and persistence logic would make 20-platform support difficult.
- Backend-driven page detection: rejected because the backend cannot reliably inspect authenticated browser page state.
- Analytics-first telemetry: rejected because Phase 1 requires reliable session reconstruction before derived metrics.

## Related Components

- Observability SDK
- Collector Registry
- Session Engine
- Event Pipeline
- Persistent Store

## References

- [Observability SDK](../architecture/observability-sdk.md)
- [Telemetry](../architecture/telemetry.md)
