# Retrieval Plan Generation

```mermaid
flowchart TB
  Classification["Intent Classification"] --> IntentSet["Primary + Secondary Intents"]
  IntentSet --> SourceRegistry["Source Registry"]
  IntentSet --> StrategyRegistry["Strategy Registry"]
  IntentSet --> RuleRegistry["Planner Rule Registry"]
  SourceRegistry --> CandidateSources["Candidate Sources"]
  StrategyRegistry --> CandidateStrategies["Candidate Strategies"]
  RuleRegistry --> RulePlans["Rule Plan Fragments"]
  CandidateSources --> RulePlans
  CandidateStrategies --> RulePlans
  RulePlans --> Merge["Merge and Deduplicate"]
  Merge --> Confidence["Confidence Plan"]
  Merge --> Budget["Token Budget"]
  Merge --> Priority["Execution Priority"]
  Confidence --> Plan["Retrieval Plan"]
  Budget --> Plan
  Priority --> Plan
```

## Merge Rules

- Sources are deduplicated by name.
- The lowest numeric priority wins.
- Stable priority ordering preserves rule-specific source order for ties.
- Strategies are deduplicated by name and sorted by priority.
- Required confidence is the maximum required by matched rules and selected sources.
- Estimated context tokens are capped at the maximum planner budget.
- Unknown questions produce an insufficient evidence plan.

