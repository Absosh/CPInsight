# Glossary

This glossary defines project-specific and infrastructure terms used across CPInsight documentation.

## Analytics Engine

Backend service logic that computes metrics such as solved problem counts, rating progression, activity heatmaps, topic strength, streaks, and CPInsight score. See [Backend](architecture/backend.md) and [Analytics API](api/analytics-api.md).

## Architecture Decision Record

A permanent record describing the context, decision, alternatives, consequences, related components, and references for an architectural choice. See [decisions](decisions/ADR-0001-platform-agnostic-observability-sdk.md).

## Collector

A platform-specific plugin that understands one platform's URLs and DOM. Collectors emit generic page context and do not manage sessions, storage, analytics, or networking. See [ADR-0002](decisions/ADR-0002-plugin-collector-architecture.md).

## Collector Registry

SDK component that validates and registers collectors, initializes them, and resolves the collector that supports a URL. See [Observability SDK](architecture/observability-sdk.md).

## Content Script

A Chrome extension script injected into matching web pages. CPInsight uses content scripts for LeetCode collection, Observability SDK page snapshots, and auth bridging. See [Chrome Extension](architecture/chrome-extension.md).

## Deduplication

The process of suppressing semantically duplicate events. CPInsight separates deduplication keys from UUID event identity. See [ADR-0010](decisions/ADR-0010-uuid-event-identity.md).

## Durable Queue

Persistent queue stored in Chrome local storage for Observability SDK events. It allows events to survive extension restart and offline mode before future backend upload exists. See [ADR-0008](decisions/ADR-0008-transport-abstraction.md).

## Event Bus

SDK dispatcher that emits validated telemetry events after pipeline processing, persists them, publishes them to transport, and notifies listeners. See [ADR-0006](decisions/ADR-0006-event-pipeline.md).

## Domain Event Bus

Backend-wide publish/subscribe backbone for immutable business facts. It is independent of telemetry and routes domain events to subscribers with middleware, ordering, retry, and failure isolation. See [Domain Event Bus](architecture/domain-event-bus.md).

## Domain Event

Immutable backend event containing event identity, type, version, aggregate identity, source, payload, metadata, correlation id, and causation id.

## Transactional Outbox

Database-backed event publication pattern that stores domain events in the same transaction as business data, then relays them after commit. See [Transactional Outbox](architecture/transactional-outbox.md).

## Outbox Relay

Background worker that leases pending outbox events, publishes them to the Domain Event Bus, records success or failure, and supports replay.

## Redis Event Distribution

Redis Streams transport layer for distributing committed domain events to cross-process consumers. See [Redis Event Distribution](architecture/redis-event-distribution.md).

## Consumer Group

Redis Streams mechanism that load-balances stream entries across consumers and tracks pending entries for recovery.

## WebSocket Gateway

Authenticated realtime delivery service that consumes Redis Streams and routes serialized messages to subscribed clients. See [WebSocket Gateway](architecture/websocket-gateway.md).

## Channel

Logical realtime subscription target such as `telemetry:{userId}`, `analytics:{userId}`, `contest:{contestId}`, or `system`.

## Behavior Intelligence

Backend subsystem that reconstructs telemetry sessions and extracts behavioral features. See [Behavior Intelligence](architecture/behavior-intelligence.md).

## Feature Store

Immutable database-backed collection of behavioral feature rows with value, confidence, source session, window, extractor id, and version.

## Behavior Profile

Aggregated behavioral view derived from feature rows across dimensions such as reading style, decision style, attention, persistence, and time management.

## Behavior Knowledge Graph

A persisted graph of versioned nodes and edges that represents evidence-backed behavioral strengths, weaknesses, and patterns. See [Behavior Knowledge](architecture/behavior-knowledge.md).

## Insight Engine

The rule-based subsystem that converts behavior features into semantic insights, graph relationships, evidence records, patterns, and inference metrics. See [Insight Engine](architecture/insight-engine.md).

## Insight Rule

A plugin implementing the knowledge inference contract. Each rule inspects behavior features and may emit immutable insights with confidence and evidence.

## Knowledge Node

A versioned graph vertex such as a user, strength, weakness, or behavior pattern.

## Knowledge Edge

A directed relationship between two knowledge nodes, with relationship type, confidence, evidence, and version.

## Intent Classification

Deterministic planner step that maps a natural-language question to one or more supported intents without calling an LLM. See [Intent Classification](architecture/intent-classification.md).

## Retrieval Planner

Planning-only backend subsystem that selects required evidence, retrieval sources, strategies, confidence requirements, token budget, and execution priority. It does not retrieve data. See [Retrieval Planner](architecture/retrieval-planner.md).

## Retrieval Source

Registered metadata describing a future retrievable evidence source, including supported intents, estimated cost, latency, confidence requirement, and context estimate.

## Retrieval Strategy

Registered metadata describing how a future retrieval engine should query selected sources, such as graph traversal, evidence-chain retrieval, historical window retrieval, or SQL retrieval.

## Hybrid Retrieval Engine

Backend subsystem that executes retrieval plans across registered source adapters and emits immutable Evidence Packages. See [Hybrid Retrieval](architecture/hybrid-retrieval.md).

## Evidence Package

Immutable retrieval output containing retrieved source summaries, ranked evidence, contradictions, confidence summary, missing evidence, and retrieval statistics.

## Evidence Fusion

Pipeline that normalizes, deduplicates, ranks, and contradiction-checks retrieved source evidence. See [Evidence Fusion](architecture/evidence-fusion.md).

## Source Adapter

Retrieval component that knows how to query one evidence source behind a common adapter contract.

## Lease

Temporary ownership marker that allows one relay worker to process an outbox row while allowing automatic recovery after expiration.

## Aggregate

Consistency boundary used by the Domain Event Bus for ordering. Events with the same aggregate type and aggregate id are dispatched serially.

## Event Pipeline

Middleware-capable SDK component that normalizes, validates, deduplicates, and freezes events before they are persisted and transported. See [Observability SDK](architecture/observability-sdk.md).

## Telemetry Processing Pipeline

Backend pipeline that processes uploaded telemetry batches through validation, ordering, idempotency, enrichment, classification, persistence, metrics, and acknowledgement stages. Future analytics, replay, and streaming systems should consume processed telemetry records from this pipeline. See [ADR-0013](decisions/ADR-0013-telemetry-processing-pipeline.md).

## Extension Runtime

The Chrome extension execution environment, including service worker, popup, content scripts, injected scripts, message bus, and Chrome storage.

## Finite State Machine

A deterministic model of allowed session states and transitions. CPInsight uses an FSM for observability session lifecycle. See [ADR-0004](decisions/ADR-0004-lifecycle-state-machine.md).

## JWT

JSON Web Token. CPInsight uses signed JWTs for access and refresh tokens. See [Authentication](architecture/authentication.md).

## Lifecycle Manager

SDK component that validates session state transitions and records state history. See [Observability SDK](architecture/observability-sdk.md).

## Manifest V3

Current Chrome extension platform model used by CPInsight. It uses service workers instead of persistent background pages and requires durable storage for state that must survive worker suspension.

## Observability SDK

Platform-agnostic SDK that owns telemetry sessions, event validation, event pipeline, persistence, queueing, and transport abstraction. See [ADR-0001](decisions/ADR-0001-platform-agnostic-observability-sdk.md).

## Persistence Layer

SDK or backend layer responsible for durable storage. In the backend this means PostgreSQL repositories. In the Observability SDK this means Chrome local storage through `PersistentStore`.

## Platform Account

A user-connected competitive programming account such as Codeforces, CodeChef, LeetCode, or AtCoder. Stored in `platform_accounts`.

## Refresh Token

JWT used to obtain a new access token. CPInsight stores refresh token hashes in PostgreSQL and rotates refresh tokens on refresh. See [Security](SECURITY.md).

## Repository

SQL access module in the backend. Repositories isolate database queries from service orchestration.

## Service Worker

Manifest V3 background execution context for the extension. It coordinates messages, provider sync, Observability SDK initialization, alarms, and tab events.

## Session Engine

SDK component that owns contest session creation, duplicate prevention, tab ownership, problem switching, recovery, and archival. See [ADR-0003](decisions/ADR-0003-session-engine.md).

## Session Ownership

The mapping between browser tabs and a single active observability session. Ownership prevents duplicate sessions when one contest is opened in multiple tabs.

## Telemetry

Structured event data that describes contest-session lifecycle and page transitions. Observability SDK telemetry is persisted locally, uploaded in authenticated batches, acknowledged by the backend, and stored as raw telemetry events. See [Telemetry](architecture/telemetry.md).

## Transport Layer

SDK abstraction that publishes events after persistence. The current transport queues events locally; future transports may use HTTP, WebSocket, gRPC, or desktop bridges.

## UUID

Universally Unique Identifier. Observability SDK events use UUID identity while deduplication uses separate metadata keys.

## Worker

A background execution unit. In CPInsight documentation this usually refers to the Chrome extension service worker or future backend jobs.
