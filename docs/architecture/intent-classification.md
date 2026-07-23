# Intent Classification

Intent Classification determines what a natural-language question is asking before any retrieval or LLM step exists. It is rule-based, deterministic, and supports multiple simultaneous intents.

This subsystem does not retrieve data, build prompts, call an LLM, use embeddings, or generate answers.

## Intent Taxonomy

| Intent | Purpose | Example |
| --- | --- | --- |
| `diagnostic` | Explain causes behind an outcome or behavior | `Why did my rating drop?` |
| `comparative` | Compare contests, sessions, topics, platforms, or windows | `Compare my last five contests` |
| `predictive` | Plan for future likelihood or readiness evidence | `Can I solve harder problems?` |
| `coaching` | Ask for practice direction | `What should I practice?` |
| `reflective` | Understand style, strengths, weaknesses, or habits | `What kind of solver am I?` |
| `exploratory` | Open-ended discovery | `Show me something interesting` |
| `evidence_request` | Ask why the system believes a claim | `Why do you think I panic?` |
| `historical_review` | Review past contests or time windows | `Review last month` |
| `trend_analysis` | Ask whether a metric or behavior is changing | `Am I improving?` |
| `goal_planning` | Plan against a target | `Plan my path to expert` |
| `unknown` | No confident known intent | `quasar banana entropy` |

## Classifier Contract

Input:

```json
{
  "question": "Why did my rating drop?"
}
```

Output:

```json
{
  "primaryIntent": "diagnostic",
  "secondaryIntents": ["historical_review"],
  "confidence": 0.75,
  "ambiguous": false,
  "questionHash": "sha256"
}
```

The classifier stores only a question hash through the API persistence path. It does not persist the raw question text.

## Rule Model

Rules are deterministic keyword and phrase matchers with weighted scores. The highest score becomes the primary intent. Other supported matches become secondary intents.

This approach is intentionally simple for Phase 3.4A because the planner must be inspectable before future LLM or retrieval components depend on it.

## Ambiguity

A question is marked ambiguous when the second-highest intent score is close to the primary score. Ambiguity does not block planning; it causes the Retrieval Planner to include evidence for multiple intents.

