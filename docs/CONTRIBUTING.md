# Contributing Guide

This guide explains how to contribute safely to CPInsight. It is written for future maintainers and external contributors.

## Repository Structure

```text
backend/       Express API, services, repositories, migrations
extension/     Chrome extension, providers, popup, Observability SDK
pages/         Static frontend HTML
script/        Frontend JavaScript
css/           Frontend CSS
ops/           Operational configuration and scripts
docs/          Engineering documentation
```

Architecture details are in [System Overview](architecture/system-overview.md).

## Development Setup

See [Operations](OPERATIONS.md) for environment setup and startup commands.

Minimum local workflow:

```powershell
cd backend
npm ci
cd ..\extension
npm ci
```

## Coding Conventions

- Preserve existing module style in the area being edited.
- Backend uses CommonJS.
- Extension SDK and extension modules use ES modules.
- Keep controllers thin and move business logic into services.
- Keep SQL access in repositories.
- Keep collectors isolated from storage, networking, analytics, and backend logic.
- Prefer explicit validation at subsystem boundaries.

## Naming Conventions

- Use descriptive filenames that match subsystem responsibility.
- Use platform names only inside platform-specific clients, providers, collectors, routes, or docs.
- Observability SDK core should not contain platform-specific names or hostnames.
- ADR files use `ADR-XXXX-short-title.md`.

## Branch Naming

Use the repository's default Codex branch prefix when creating agent branches:

```text
codex/<short-description>
```

Human contributors may use:

```text
feature/<short-description>
fix/<short-description>
docs/<short-description>
```

## Commit Messages

Use concise conventional messages:

```text
feat(observability): add collector registry
fix(auth): reject revoked refresh tokens
docs(architecture): update extension lifecycle notes
test(extension): cover duplicate session recovery
```

## Code Review Expectations

Reviewers should check:

- Correct subsystem ownership.
- No unrelated refactors.
- No collector-to-backend coupling.
- No platform branching in Observability SDK core.
- Input validation for new API boundaries.
- Database migration safety.
- Test coverage proportional to risk.
- Documentation updated when architecture, operations, APIs, or security assumptions change.

## Documentation Standards

- Markdown only under `docs/`.
- Use Mermaid for diagrams.
- Link to existing docs instead of repeating long explanations.
- Clearly distinguish implemented behavior from future plans.
- Do not add empty sections.
- Update [docs/README.md](README.md) when adding major documents.

## Testing Requirements

Before opening a pull request, run applicable checks:

```powershell
cd backend
npm test
```

```powershell
cd extension
node tests/observability-runtime-verification.mjs
```

For database changes:

```powershell
docker compose --profile tools run --rm migrate
```

See [Testing](TESTING.md).

## Architecture Principles

- Separation of Concerns.
- Single Responsibility Principle.
- Open/Closed Principle for platform integrations.
- Dependency inversion between collectors and SDK core.
- Durable state for crash and restart recovery.
- Idempotency for upload and telemetry paths.
- Backend owns canonical data persistence.

## How to Add a New Collector

1. Read [Observability SDK](architecture/observability-sdk.md).
2. Implement the collector contract:
   - `id`
   - `platform`
   - `initialize`
   - `supports`
   - `collect`
   - `pause`
   - `resume`
   - `destroy`
3. Place platform-specific code under `extension/observability/platforms/<platform>/`.
4. Register the collector in `extension/observability/platforms/index.js`.
5. Add manifest host permissions and content script matches if the collector runs in Chrome.
6. Extend runtime verification for contest detection, problem switching, duplicate tabs, recovery, and invalid URLs.
7. Update docs and ADRs only if the generic architecture changes.

Collectors must not:

- Call backend APIs.
- Write Chrome storage directly.
- Perform analytics.
- Manage session lifecycle.
- Read secrets, cookies, passwords, clipboard, or unrelated browsing history.

## How to Add Backend APIs

1. Add a route under `backend/src/routes`.
2. Add Joi validation if the request has params, query, or body.
3. Add a controller method.
4. Add service logic.
5. Add repository methods for SQL access.
6. Add migrations for schema changes.
7. Update [API Reference](api/README.md) and related API documents.
8. Add tests or documented verification steps.

## How to Update Documentation

1. Find the current source-of-truth document in [docs/README.md](README.md).
2. Update the most specific document first.
3. Add cross-references where the change affects another subsystem.
4. Run the link check described in [Testing](TESTING.md) or use the validation command from the final docs audit.

## Pull Request Checklist

- Scope is focused.
- Production code changes are justified.
- Tests or runtime verification were run.
- New APIs include validation.
- New storage changes include migration or recovery behavior.
- Security implications are documented.
- Relevant docs are updated.
- No secrets are committed.
- `.env.deploy` remains ignored.

## Release Checklist

- Migrations reviewed and tested.
- Backend syntax checks pass.
- Extension runtime verification passes.
- Dependency audit reviewed.
- API smoke tests pass.
- Documentation index is current.
- Changelog updated.
- Deployment order from [Operations](OPERATIONS.md) is followed.
