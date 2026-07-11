# Future AI Services

AI modules should depend on normalized repository reads and analytics payloads:

- `weaknessDetectionService`
- `contestReviewService`
- `trainingPlanService`
- `ratingPredictionService`

Do not call platform scrapers or upstream APIs directly from AI services. This keeps prompts reproducible, auditable, and cacheable.
