# AI Component Composition

AI surfaces should compose from small presentational components rather than embedding custom rendering for every feature.

## Composition Rules

- Use `AiThemeProvider` at the feature boundary.
- Use `AiInteractionProvider` to pass callbacks such as inspect evidence, open timeline, retry, or feedback.
- Use `CoachResponse` for validated AI Coach output.
- Use `EvidenceExplorer` when evidence filtering or source inspection is needed.
- Use `ReasoningPanel` for causal chains, contradictions, and missing evidence.
- Use `QualityIndicator` whenever a response claims validation or grounding.
- Keep data fetching in page/service modules outside `src/components/ai`.

## Layout Patterns

| Pattern | Component |
| --- | --- |
| Sidebar/workspace/dock | `AiWorkspace` |
| Two-column evidence and reasoning | `SplitView` |
| Responsive repeated items | `CardGrid` |
| Chat or coach thread | `ConversationView` |
| Roadmap or plan | `RoadmapViewer`, `ActionPlan` |
| Contest review | `ContestReview` |

## Example

```jsx
<AiThemeProvider mode="dark">
  <AiInteractionProvider handlers={handlers}>
    <CoachResponse
      question={question}
      response={validatedResponse}
      quality={qualityReport}
      reasoning={reasoningContext}
      evidence={evidencePackage.evidence}
      recommendations={validatedResponse.recommendations}
    />
  </AiInteractionProvider>
</AiThemeProvider>
```
