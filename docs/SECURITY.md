# Security Engineering

This document describes implemented protections, current assumptions, and future security work. It complements [Authentication Architecture](architecture/authentication.md), [Chrome Extension Architecture](architecture/chrome-extension.md), and [API Reference](api/README.md).

## Threat Model

Primary assets:

- User accounts.
- Password hashes.
- Refresh token hashes.
- Platform account handles and analytics data.
- Extension upload payloads.
- Telemetry events and domain events.

Primary threats:

- Credential stuffing and brute force login attempts.
- Access token theft.
- Refresh token replay.
- Malicious or malformed API input.
- Extension content-script overcollection.
- Cross-origin misuse of backend APIs.
- Dependency vulnerabilities.
- Leaked deployment secrets.

## Implemented Protections

| Area | Protection |
| --- | --- |
| Password storage | bcrypt hashes with configurable rounds. |
| Access tokens | JWTs signed with `JWT_ACCESS_SECRET`, issuer `cpinsight-api`. |
| Refresh tokens | JWTs signed separately, stored by SHA-256 hash, rotated on refresh. |
| Authentication middleware | Verifies bearer token and loads the user from PostgreSQL. |
| Input validation | Joi schemas on auth, user, platform, extension upload, and telemetry upload routes. |
| HTTP hardening | Helmet middleware. |
| Rate limiting | Global limiter, auth limiter, analytics limiter. |
| CORS | Centralized CORS configuration. |
| Extension permissions | Host permissions limited to implemented platform and API domains. |
| Telemetry boundary | Observability collectors do not read cookies, passwords, clipboard, or browser history. |
| Secrets | `.env.deploy` is ignored by Git. |

## Authentication and Authorization

Protected API routes require:

```http
Authorization: Bearer <accessToken>
```

Authorization is currently user-scoped. Services use `req.user.id` to read and mutate the current user's resources.

Refresh token rotation:

1. Verify refresh JWT.
2. Look up active hash.
3. Issue replacement access and refresh tokens.
4. Revoke the previous refresh token.

## Extension Security

The extension uses Manifest V3, which replaces persistent background pages with a service worker model. Security-relevant properties:

- Content scripts are scoped by manifest matches.
- Background logic runs in the extension service worker.
- Page-realm interaction is mediated through message bridges.
- Observability collectors only parse current page URL and DOM metadata needed for session reconstruction.

The extension does not request cookie, clipboard, password, or history permissions.

## Content Security Policy

Chrome extensions are subject to Manifest V3 extension CSP rules. The repository does not define a custom `content_security_policy` in `manifest.json`. If custom CSP is added later, it should avoid `unsafe-eval` and remote script execution.

## Input Validation

Implemented Joi schemas validate:

- Registration, login, refresh, logout.
- Profile updates and avatar upload payload size.
- Platform connect and sync parameters.
- LeetCode extension upload shape.
- Observability SDK telemetry upload batch shape.

Telemetry ingestion validates the Observability SDK event schema server-side; local SDK validation is not a substitute for backend validation.

## Output Encoding

The frontend is static browser JavaScript and HTML. Any future rendering of user-provided fields should use DOM text APIs rather than HTML injection. Backend JSON responses should not include password hashes, token hashes, or secrets.

## Secrets Management

Never commit:

- `.env.deploy`
- JWT secrets
- Database passwords
- Redis credentials
- Production API keys

Rotate secrets if they are exposed in logs, commits, screenshots, or issue reports.

## Sensitive Telemetry Boundaries

Implemented Observability SDK events collect only:

- Session id.
- Platform.
- Contest id and name.
- Problem id.
- Event type.
- Timestamp.
- Current page URL.
- Minimal metadata for session reconstruction.

Collectors must not collect:

- Passwords.
- Cookies.
- Authentication tokens.
- Clipboard content.
- Private messages.
- Arbitrary browsing history.
- Full page snapshots.

## Transactional Outbox and Replay

Domain events persisted in the transactional outbox must follow the same data minimization boundary as telemetry. Replay is implemented as an internal relay capability and should only be exposed through future administrative interfaces that require authentication, authorization, audit logging, and explicit operator intent.

Redis event payloads carry the same immutable domain event contract. Consumers must treat `eventId` as the idempotency key and must not enrich Redis stream entries with secrets, access tokens, refresh tokens, cookies, clipboard data, or sensitive DOM content.

WebSocket clients authenticate with JWT access tokens during upgrade. The gateway never trusts client-supplied identity and authorizes every channel subscription before routing events.

Behavior features are derived from telemetry metadata only. The engine must not introduce sensitive DOM, cookies, tokens, clipboard data, or private messages into feature values or profiles.

Behavior knowledge consumes persisted behavior features only. It stores inferred strengths, weaknesses, patterns, confidence, and evidence references; it must not copy raw DOM, cookies, tokens, clipboard contents, or unrelated browser history into graph properties or insight evidence payloads.

The Retrieval Planner stores question hashes, classifications, plans, and metrics. It must not persist raw natural-language questions, prompt text, generated answers, embeddings, or retrieved context in Phase 3.4A.

The Hybrid Retrieval Engine stores Evidence Packages assembled from existing canonical backend data. It must not add secrets, cookies, access tokens, refresh tokens, prompt text, generated answers, embeddings, or raw question text to package payloads.

## Dependency Security

Run backend production audit:

```powershell
cd backend
npm run audit:prod
```

Run extension dependency audit manually when needed:

```powershell
cd extension
npm audit
```

Dependency updates should be reviewed for runtime behavior changes, especially extension dependencies and backend auth libraries.

## Responsible Disclosure Policy

Until a public security contact exists, security issues should be reported privately to the repository maintainer. Public issues should not include exploit details, secrets, or live user data.

A mature public release should add:

- Dedicated security contact.
- Supported versions policy.
- Disclosure timeline.
- CVE handling policy if applicable.

## Known Security Assumptions

- The frontend runtime is trusted to store and present tokens safely.
- Backend JWT secrets are high entropy and not reused.
- PostgreSQL is the canonical data store and is protected by deployment network boundaries.
- Redis is treated as cache and not as durable secret storage.
- Extension host permissions remain limited as new collectors are added.

## Future Security Improvements

- Automated dependency scanning in CI.
- API integration tests for refresh-token replay.
- Security headers review for frontend Nginx.
- Additional telemetry ingestion abuse detection and quota policy.
- Administrative authorization controls before exposing outbox replay over HTTP.
- Extension message fuzz tests.
- Content Security Policy explicitly documented for extension and frontend.
- Public responsible disclosure policy.

## Related Documentation

- [Authentication](architecture/authentication.md)
- [Chrome Extension](architecture/chrome-extension.md)
- [Telemetry](architecture/telemetry.md)
- [Operations](OPERATIONS.md)
