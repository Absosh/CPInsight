# ADR-0003 Session Engine

## Status
Accepted

## Date
2026-07-22

## Context

Contest telemetry needs exactly one active session per contest, even when the user opens multiple tabs, refreshes the page, closes a tab, or restarts the browser. If collectors managed sessions independently, duplicate sessions and inconsistent ownership would be likely.

## Decision

Session ownership is centralized in `SessionEngine`. Sessions are keyed by collector id and contest id. The engine attaches and detaches tabs, updates current problem state, emits lifecycle events, and recovers unfinished sessions from durable storage.

## Consequences

Positive:

- Duplicate prevention is centralized.
- Cross-tab ownership transfer is handled in one place.
- Collectors do not need to know about browser recovery.

Negative:

- Session Engine is a critical shared component and must stay well tested.
- Current session key assumes collector id plus contest id is sufficient for active-session uniqueness.

## Alternatives Considered

- Per-tab sessions: rejected because one contest opened twice would create duplicate active sessions.
- Collector-owned sessions: rejected because each platform would need to reimplement recovery and duplicate prevention.
- Backend-owned sessions only: rejected because offline mode and browser restart recovery require local state.

## Related Components

- Session Engine
- Persistent Store
- Lifecycle Manager
- Event Bus

## References

- [Contest Session Sequence](../sequence/contest-session.md)
- [Observability SDK](../architecture/observability-sdk.md)
