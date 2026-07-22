# ADR-0009 Collector Contract

## Status
Accepted

## Date
2026-07-22

## Context

Collectors must be interchangeable plugins. Without a lifecycle contract, some collectors could omit cleanup, pause behavior, or initialization, leading to leaks or inconsistent runtime behavior.

## Decision

Collectors implement one common interface:

```text
initialize()
supports()
collect()
pause()
resume()
destroy()
```

The SDK validates this contract during registration.

## Consequences

Positive:

- Collector lifecycle is predictable.
- Content scripts can clean up collectors on page unload.
- Future collectors can be tested against one compatibility contract.

Negative:

- Simple collectors still need no-op lifecycle methods.
- Additional lifecycle needs must be added carefully to avoid breaking existing collectors.

## Alternatives Considered

- Duck typing without validation: rejected because missing methods would fail at runtime.
- Separate per-platform contracts: rejected because collectors would not be interchangeable.
- Large plugin interface: rejected because it would over-constrain early collectors.

## Related Components

- Collector Contract
- Collector Registry
- Observability Content Script

## References

- [Chrome Extension](../architecture/chrome-extension.md)
- [Observability SDK](../architecture/observability-sdk.md)
