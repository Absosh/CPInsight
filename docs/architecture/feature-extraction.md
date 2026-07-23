# Feature Extraction

Feature extraction is plugin-based. Each extractor receives a reconstructed session and optional contest reconstruction context.

## Extractor Contract

```text
initialize()
supports(session, context)
extract(session, context)
confidence(session, context)
version()
destroy()
```

New extractors require registration only. Existing reconstruction and persistence code does not need modification.

## Implemented Extractors

| Extractor | Feature Group |
| --- | --- |
| Reading Behavior | `reading_behavior` |
| Decision Making | `decision_making` |
| Problem Solving | `problem_solving` |
| Attention | `attention` |
| Contest Strategy | `contest_strategy` |
| Difficulty Management | `difficulty_management` |
| Productivity | `productivity` |

## Feature Store Contract

Each feature row stores:

- Feature name.
- Feature group.
- JSON value.
- Confidence.
- Window key.
- Source session.
- Platform.
- Contest id.
- Extractor id.
- Feature version.
- Creation timestamp.

Feature rows are immutable. Recomputation creates new rows and may create a new profile version.

## Observability

Extraction runs record:

- Sessions reconstructed.
- Features extracted.
- Extraction latency.
- Confidence distribution.
- Incomplete sessions.
- Failed reconstructions.
- Feature version.
- Status.
