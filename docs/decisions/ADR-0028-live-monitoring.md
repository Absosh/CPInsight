# ADR-0028 Live Contest Monitoring

## Status
Accepted

## Date
2026-07-23

## Context

CPInsight had durable telemetry upload, processing, outbox publication, Redis distribution, WebSocket delivery, behavior intelligence, knowledge graph, AI runtime, quality validation, design system, and AI Coach Workspace. The missing product link was a real-time contest monitoring feature that could collect live contest signals and stream them into the existing architecture.

The implementation needed to support real Codeforces contests first without creating a parallel telemetry architecture or duplicating AI logic in the frontend or extension.

## Decision

Add a Live Contest Monitoring layer:

- Extension popup starts/stops/reconnects monitoring.
- Extension background detects Codeforces contest pages.
- Codeforces polling uses official APIs.
- Submission diffing emits only new telemetry events.
- Extension queues events offline in Chrome local storage.
- Backend live session endpoints create signed sessions and accept live events.
- Live events are adapted into the existing telemetry batch pipeline.
- Existing outbox, domain event bus, Redis distribution, and WebSocket gateway deliver updates.
- Frontend live dashboard consumes WebSocket events and renders deterministic state.

## Consequences

Positive consequences:

- Live monitoring reuses existing telemetry guarantees.
- Collectors and AI systems are not redesigned.
- Codeforces support is real and API-backed.
- Session tokens reduce forged event risk.
- The dashboard receives routed domain events instead of reading raw database state.

Trade-offs:

- Review generation is queued through `contest_review_jobs`; a dedicated asynchronous review worker must execute the existing AI pipeline in a later hardening pass.
- Current implementation requires the user to provide the Codeforces handle in the popup.
- Browser verification against a real active contest requires an authenticated extension install and live Codeforces contest page.

## Alternatives Considered

- Scrape Codeforces HTML verdicts: rejected because official APIs are available.
- Send events directly to WebSocket: rejected because it would bypass telemetry ingestion and persistence.
- Put behavior inference in the extension: rejected because behavior intelligence is backend-owned.
- Create a separate live telemetry backend: rejected because it would duplicate the existing telemetry architecture.

## Related Components

- Extension Live Telemetry SDK
- Codeforces API Client
- Submission Diff Engine
- Live Telemetry Session API
- Existing Telemetry Pipeline
- WebSocket Gateway
- Live Contest Dashboard

## References

- [Extension Live Monitoring](../extension/live-monitoring.md)
- [Live Telemetry Session API](../backend/telemetry-session.md)
- [Submission Diff Engine](../backend/submission-diff-engine.md)
- [Live Contest Dashboard](../frontend/live-dashboard.md)
