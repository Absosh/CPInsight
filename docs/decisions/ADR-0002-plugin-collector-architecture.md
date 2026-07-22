# ADR-0002 Plugin Collector Architecture

## Status
Accepted

## Date
2026-07-22

## Context

Each competitive programming platform has different URLs, DOM structures, contest states, and problem identifiers. Embedding those differences in SDK core would violate separation of concerns and force future platforms to modify shared infrastructure.

## Decision

Collectors are plugins registered through `CollectorRegistry`. A collector exposes `id`, `platform`, `initialize`, `supports`, `collect`, `pause`, `resume`, and `destroy`. The registry validates this contract and resolves collectors by `supports(url)`.

## Consequences

Positive:

- Platform code is isolated.
- Collector lifecycle is consistent.
- Future platform onboarding requires a new collector and registration.

Negative:

- Registration is still a repository change today.
- Manifest host permissions must still be updated for browser collectors.

## Alternatives Considered

- Switch statements by platform: rejected because they spread platform branching through SDK code.
- One content script per platform with independent storage: rejected because it duplicates lifecycle and persistence.
- Runtime remote plugins: rejected for Manifest V3 security and review complexity at this stage.

## Related Components

- `extension/observability/core/collector-registry.js`
- `extension/observability/plugin-api/collector-contract.js`
- `extension/observability/platforms/`

## References

- [Chrome Extension](../architecture/chrome-extension.md)
- [Observability SDK](../architecture/observability-sdk.md)
