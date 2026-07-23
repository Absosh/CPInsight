# ADR-0026 AI Design System

## Status
Accepted

## Date
2026-07-23

## Context

The backend AI platform now produces evidence packages, reasoning contexts, execution plans, raw model responses, validated coach responses, quality reports, reflections, and feedback metrics. Future frontend surfaces will need to show AI output consistently across coach answers, contest reviews, study plans, behavior analytics, reflection timelines, roadmaps, and mentor mode.

Without a dedicated design system, each feature would likely invent its own rendering for confidence, evidence, citations, recommendations, and reasoning chains. That would increase cognitive load, weaken trust, and make accessibility inconsistent.

The repository currently has a static frontend rather than a React application. The design system therefore needs to be isolated and reusable without forcing a migration of existing pages.

## Decision

Create a dedicated React AI Design System under `src/components/ai`. The module provides design tokens, themes, providers, base components, core AI components, composite components, layout primitives, animation classes, Storybook stories, and a static verification script.

The design system is strictly presentational. It receives data through props and exposes interaction callbacks through providers. It does not call APIs, perform retrieval, validate AI output, route tasks, or mutate backend state.

## Consequences

Positive consequences:

- AI features share a consistent evidence-first visual language.
- Confidence, quality, citations, recommendations, and reflections have reusable components.
- Dark, light, and high-contrast themes use semantic tokens.
- Future React surfaces can adopt the module without backend changes.
- Storybook creates an isolated review surface before full frontend migration.

Negative consequences and trade-offs:

- The root frontend now has React and Storybook workspace metadata even though current pages remain static.
- Storybook dependencies must be installed before visual review.
- The icon layer defines preferred Lucide icon names but uses lightweight fallback glyphs until a React icon package is installed.
- Visual regression testing is documented and scaffolded but not integrated into CI in this phase.

## Alternatives Considered

- Extend existing static CSS only: rejected because future AI features need composable stateful React components.
- Build components inside each feature: rejected because evidence, confidence, and reasoning patterns would diverge.
- Couple UI components to backend DTOs directly: rejected because it would embed business logic and make future API evolution harder.
- Adopt a third-party design system wholesale: rejected because CPInsight needs domain-specific AI interaction patterns for evidence, grounding, and reflection.

## Related Components

- AI Design Tokens
- Theme Provider
- Core AI Components
- Composite AI Components
- Layout System
- Animation System
- Storybook

## References

- [AI Design System](../frontend/ai-design-system.md)
- [Design Tokens](../frontend/design-tokens.md)
- [Component Library](../frontend/component-library.md)
- [Component Composition](../frontend/component-composition.md)
- [Animation System](../frontend/animation-system.md)
- [Accessibility](../frontend/accessibility.md)
- [Storybook](../frontend/storybook.md)
