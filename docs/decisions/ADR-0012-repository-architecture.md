# ADR-0012 Repository Architecture

## Status
Accepted

## Date
2026-07-22

## Context

CPInsight contains multiple runtime surfaces: frontend, backend, extension, infrastructure, and documentation. A flat or mixed structure would slow future contributors and make ownership unclear.

## Decision

The repository is organized by runtime boundary:

- `backend/` for Express API, services, repositories, migrations, and backend runtime.
- `extension/` for Chrome extension, providers, messaging, popup, storage, and Observability SDK.
- `pages/`, `script/`, and `css/` for static frontend.
- `ops/` for operational scripts and configs.
- `docs/` for engineering documentation.

## Consequences

Positive:

- Contributors can locate subsystem ownership quickly.
- Runtime dependencies remain visually separated.
- Documentation has a single source-of-truth directory.

Negative:

- Static frontend files are split across `pages`, `script`, and `css`, which requires naming discipline.
- Cross-cutting features require documentation links across directories.

## Alternatives Considered

- Monolithic `src/` directory: rejected because frontend, backend, and extension have different runtimes.
- Package workspace split: not currently necessary because the codebase is not yet packaged as multiple npm workspaces.
- Documentation inside each subsystem only: rejected because architecture needs a single navigable source of truth.

## Related Components

- Frontend
- Backend
- Extension
- Documentation
- Ops

## References

- [Documentation README](../README.md)
- [System Overview](../architecture/system-overview.md)
