# ADR-0004 Lifecycle State Machine

## Status
Accepted

## Date
2026-07-22

## Context

Contest sessions move through a small number of valid states. Browser refresh, tab close, extension restart, and duplicate tabs can otherwise create ambiguous state transitions. The system needs deterministic behavior and illegal-transition rejection.

## Decision

Session lifecycle uses a finite state machine:

```text
IDLE -> CONTEST_DETECTED -> SESSION_INITIALIZING -> SESSION_ACTIVE
SESSION_ACTIVE -> SESSION_PAUSED -> SESSION_RESUMED -> SESSION_ACTIVE
SESSION_ACTIVE|SESSION_PAUSED|SESSION_RESUMED -> SESSION_ENDED -> ARCHIVED
```

`LifecycleManager` validates transitions and records state history.

## Consequences

Positive:

- Impossible state transitions fail early.
- Recovery code has a constrained target model.
- State history improves diagnostics.

Negative:

- New lifecycle states require explicit transition design.
- Some browser events must be normalized before transition, such as ending from `SESSION_RESUMED`.

## Alternatives Considered

- Boolean flags: rejected because combinations become ambiguous.
- Free-form state strings: rejected because invalid states would persist silently.
- Event-only reconstruction without current state: rejected for Phase 1 because local recovery must be simple and deterministic.

## Related Components

- Lifecycle Manager
- Session Engine

## References

- [Observability SDK](../architecture/observability-sdk.md)
