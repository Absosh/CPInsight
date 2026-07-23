# Prompt Strategy Engine

The Prompt Strategy Engine selects deterministic prompt strategy metadata for an AI task. Strategies never call an LLM.

## Strategies

| Strategy | Purpose |
| --- | --- |
| Diagnostic Strategy | Cause-oriented diagnosis |
| Comparative Strategy | Compare windows, contests, topics, or progress |
| Reflection Strategy | Structure reflection into successes, mistakes, lessons, and actions |
| Planning Strategy | Organize goals and milestones |
| Recommendation Strategy | Prepare action-selection instructions |
| Prediction Strategy | Prepare bounded forecasts |
| Explanation Strategy | Explain behavior from evidence |
| Evidence Strategy | Prioritize evidence audit and citations |
| Summary Strategy | Compress high-signal findings |
| Meta Strategy | Handle uncertainty and unknown tasks |

Strategies are selected by task plugin configuration. Provider-specific formatting remains future work.

