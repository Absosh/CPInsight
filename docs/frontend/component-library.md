# AI Component Library

The AI component library is organized into core components and composite components.

## Core Components

| Component | Responsibility |
| --- | --- |
| `CoachMessage` | Displays question, response, timestamp, streaming state, and metadata |
| `EvidenceCard` | Displays finding, evidence type, confidence, contest/source metadata, citations, and timeline actions |
| `ReasoningPanel` | Displays reasoning chain, primary findings, secondary findings, contradictions, and missing evidence |
| `ConfidenceBadge` | Displays confidence percentage, category, accessible tooltip, and animated update state |
| `RecommendationCard` | Displays recommendation, priority, impact, difficulty, evidence, time estimate, progress, and completion action |
| `BehaviorChip` | Displays behavior category, strength/weakness/pattern kind, trend, and tooltip |
| `ReflectionTimeline` | Displays chronological validated reflections with filtering and expandable evidence |
| `ProgressMilestone` | Displays current stage, completed count, remaining count, estimate, and progress animation |
| `SourceReference` | Displays evidence origin and inspect affordance |
| `QualityIndicator` | Displays grounding, evidence, quality, and validation status |

## Composite Components

| Component | Composition |
| --- | --- |
| `CoachResponse` | Coach message, quality indicator, reasoning panel, evidence cards, recommendations |
| `EvidenceExplorer` | Source references, evidence filtering, evidence cards |
| `RecommendationList` | Ordered recommendation cards |
| `BehaviorOverview` | Profile confidence and behavior chips |
| `ReflectionFeed` | Reflection timeline with broader filters |
| `RoadmapViewer` | Progress milestone and recommendation list |
| `ContestReview` | Review header, reasoning, evidence explorer, recommendations |
| `InsightSummary` | Validated insight chips and quality status |
| `ActionPlan` | Milestone and action recommendations |

## State Pattern

Components support loading, streaming, success, empty, partial, error, retry, and offline states through `StateShell` and semantic tokens.
