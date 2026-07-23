# ADR-0018 Behavior Intelligence Engine

## Status
Accepted

## Date
2026-07-23

## Context

Raw telemetry captures low-level page and session events, but future analytics, coaching, recommendations, RAG, and ML systems need higher-level behavioral features. These features must be derived reproducibly, versioned, persisted, and assigned confidence.

The existing telemetry infrastructure is frozen. Behavior intelligence must consume accepted telemetry without redesigning upload, processing, outbox, Redis, or realtime systems.

## Decision

CPInsight adds a Behavior Intelligence Engine with:

- Session reconstruction.
- Contest reconstruction.
- Plugin-based feature extractors.
- Immutable feature store.
- Behavior profile aggregation.
- Extraction metrics.
- Internal protected behavior APIs.

Feature extractors implement a common lifecycle contract and register through a registry. New behavioral dimensions can be added by introducing a new extractor plugin.

## Consequences

Positive:

- Raw telemetry becomes reusable behavioral intelligence.
- Features are immutable, versioned, and confidence-scored.
- Future analytics and AI systems can consume feature rows instead of raw telemetry.
- Extractors remain independently testable and extensible.

Negative:

- Features are heuristic in this phase and should not be treated as ML predictions.
- Low-confidence features require downstream filtering.
- Recomputations create additional immutable rows, so storage retention policy will matter later.

## Alternatives Considered

- Direct dashboard metrics from raw telemetry: rejected because it would duplicate reconstruction logic and prevent reuse.
- Hardcoded monolithic feature computation: rejected because future extractors need independent evolution.
- AI-based interpretation immediately: rejected because this phase is feature extraction only.

## Related Components

- Telemetry ingestion.
- Processed telemetry.
- Behavior reconstruction.
- Feature store.
- Behavior profile APIs.

## References

- [Behavior Intelligence](../architecture/behavior-intelligence.md)
- [Feature Extraction](../architecture/feature-extraction.md)
- [Behavior Reconstruction Sequence](../sequence/behavior-reconstruction.md)
- [Feature Extraction Sequence](../sequence/feature-extraction.md)
