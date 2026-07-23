# ADR-0027 AI Coach Workspace

## Status
Accepted

## Date
2026-07-23

## Context

CPInsight now has a complete backend AI platform and a reusable AI Design System. The product needed a primary AI surface that could consume validated backend outputs while preserving evidence-first UX, explainability, and trust.

A generic chat interface would hide the most important CPInsight differentiators: evidence, reasoning, confidence, recommendations, reflections, and behavioral context. The workspace needed to feel closer to an AI productivity environment than a message-only chat window.

## Decision

Create a React AI Coach Workspace under `src/features/ai-coach`. It uses a three-panel layout:

- left sidebar for sessions, navigation, search, filters, and settings;
- center workspace for multi-turn coaching and structured responses;
- right sidebar for persistent contextual insights.

The workspace consumes existing backend endpoints through `createAiCoachApiClient` and renders all AI response surfaces through the AI Design System. State is centralized in `AiCoachWorkspaceProvider` and `aiCoachReducer` to avoid prop drilling and to keep session, streaming, selection, and preferences consistent.

## Consequences

Positive consequences:

- AI output is rendered as structured evidence-backed workspace content.
- Backend AI logic remains server-side.
- The AI Design System is exercised in a real product surface.
- Session, streaming, selection, and layout state are centralized.
- The workspace is ready for future durable session APIs.

Negative consequences and trade-offs:

- Conversation persistence is currently local UI state because no durable AI session backend API exists yet.
- Streaming is represented as progressive workspace status text around the existing runtime endpoint; true token streaming requires future transport work.
- The page is Vite-oriented and requires the frontend build pipeline for production serving.

## Alternatives Considered

- Generic chat UI: rejected because it would bury evidence, reasoning, and quality signals.
- Embed AI logic in the frontend: rejected because backend services are the canonical AI pipeline.
- Add workspace state to the design system: rejected because the design system must remain presentational.
- Wait for durable session APIs: rejected because the UI shell can be built now without violating backend boundaries.

## Related Components

- AI Coach Workspace
- AI Design System
- AI Coach API Client
- Workspace Provider
- Session Reducer
- Workspace Layout

## References

- [AI Coach Workspace](../frontend/ai-coach-workspace.md)
- [Session Lifecycle](../frontend/session-lifecycle.md)
- [Workspace Layout](../frontend/workspace-layout.md)
- [Interaction Patterns](../frontend/interaction-patterns.md)
- [AI Design System](../frontend/ai-design-system.md)
