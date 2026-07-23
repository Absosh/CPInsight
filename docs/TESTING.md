# Testing Strategy

CPInsight testing is currently a mix of syntax checks, runtime verification harnesses, health checks, and manual extension validation. The repository does not yet contain a full unit or integration test suite for every backend service.

## Philosophy

- Test architectural invariants close to the subsystem that owns them.
- Prefer deterministic runtime verification for lifecycle-heavy extension behavior.
- Validate database changes with migrations against a real PostgreSQL instance.
- Treat authentication, storage recovery, idempotency, and cross-tab synchronization as reliability-critical paths.
- Document gaps explicitly instead of implying coverage that does not exist.

## Backend Testing

Install dependencies:

```powershell
cd backend
npm ci
```

Run current backend test script:

```powershell
npm test
```

Expected result:

- `backend/scripts/check-syntax.js` completes successfully.
- Exit code is `0`.

Run production dependency audit:

```powershell
npm run audit:prod
```

Pass criteria:

- No high or critical production dependency vulnerabilities remain untriaged.

## Database Testing

Start dependencies:

```powershell
docker compose up -d postgres redis
```

Run migrations:

```powershell
docker compose --profile tools run --rm migrate
```

Pass criteria:

- Migration command exits `0`.
- Tables documented in [Database Schema](database/schema.md) exist.
- Re-running migrations does not fail for migrations that use `IF NOT EXISTS`.

## API Smoke Testing

Start API:

```powershell
docker compose up -d api
```

Run:

```powershell
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

Pass criteria:

- `/health` returns a successful HTTP response.
- `/ready` returns a successful response only when dependencies are ready.

## Authentication Testing

Manual API flow:

1. `POST /api/auth/register` with a valid username, email, and strong password.
2. `POST /api/auth/login`.
3. Call a protected route with `Authorization: Bearer <accessToken>`.
4. `POST /api/auth/refresh`.
5. Verify the old refresh token cannot be reused after rotation.
6. `POST /api/auth/logout`.

Pass criteria:

- Invalid credentials return `401`.
- Invalid bodies return validation errors.
- Refresh rotation revokes the previous refresh token row.

See [Authentication API](api/authentication-api.md).

## Extension Testing

Install extension dependencies:

```powershell
cd extension
npm ci
```

Run Observability SDK runtime verification:

```powershell
node tests/observability-runtime-verification.mjs
```

Run telemetry upload runtime verification:

```powershell
node tests/telemetry-upload-runtime-verification.mjs
```

Run backend telemetry processing pipeline verification:

```powershell
cd backend
node scripts/verify-telemetry-pipeline.js
```

Run backend Domain Event Bus verification:

```powershell
cd backend
node scripts/verify-domain-event-bus.js
```

Run transactional outbox verification:

```powershell
cd backend
node scripts/verify-transactional-outbox.js
```

Run Redis event distribution verification:

```powershell
cd backend
node scripts/verify-redis-event-distribution.js
```

Run realtime gateway verification:

```powershell
cd backend
node scripts/verify-realtime-gateway.js
```

Run behavior intelligence verification:

```powershell
cd backend
node scripts/verify-behavior-intelligence.js
```

Run behavior knowledge verification:

```powershell
cd backend
node scripts/verify-behavior-knowledge.js
```

Run retrieval planner verification:

```powershell
cd backend
node scripts/verify-retrieval-planner.js
```

Run hybrid retrieval verification:

```powershell
cd backend
node scripts/verify-hybrid-retrieval.js
```

Run reasoning context verification:

```powershell
cd backend
node scripts/verify-reasoning-context.js
```

Run AI task orchestration verification:

```powershell
cd backend
node scripts/verify-ai-task-orchestrator.js
```

Run LLM runtime verification:

```powershell
cd backend
node scripts/verify-llm-runtime.js
```

Run AI quality layer verification:

```powershell
cd backend
node scripts/verify-ai-quality.js
```

Run AI design system verification:

```powershell
npm run verify:ai-design-system
```

Expected output includes:

```json
{
  "verdict": "PASS"
}
```

Pass criteria:

- Exit code is `0`.
- Final state includes archived session coverage.
- Queue length matches stored event count in the harness.

## Telemetry Testing

The runtime verification harness covers:

- Collector contract enforcement.
- Codeforces collector context parsing.
- CodeChef collector context parsing.
- Contest detection.
- Problem opening.
- Problem switching.
- Page reload.
- Tab hidden and visible events.
- Duplicate contest load suppression.
- Multiple tabs sharing one contest session.
- Tab close ownership transfer.
- Browser restart style recovery.
- Session archival.
- UUID event identity.
- Deduplication by metadata key.
- Corrupted storage shape recovery.

The telemetry upload verification harness covers:

- Upload sequence assignment for previously unsequenced queued events.
- Batch ordering.
- Maximum events per batch.
- Full acknowledgement cleanup.
- Partial acknowledgement preservation.
- Exponential retry state.
- Retry backoff skip.
- Offline skip.
- Queue corruption recovery.
- Oversized event rejection.
- Expired access token refresh-and-retry.
- `429 Retry-After` handling.
- Timeout classification.

The telemetry processing pipeline verification covers:

- Normal batches.
- Duplicate uploads.
- Duplicate events.
- Unsupported schema versions.
- Duplicate sequence numbers.
- Missing sequence numbers.
- Out-of-order events.
- Simulated storage failure.
- Pipeline restart and replay idempotency.
- Large batches.
- Mixed collector metadata.
- Transactional outbox event creation after processed telemetry persistence.

The Domain Event Bus verification covers:

- Multiple publishers through generic domain events.
- Multiple independently registered subscribers.
- Subscriber failure isolation.
- Subscriber retry and dead-letter routing.
- Same-aggregate ordering.
- Concurrent dispatch for different aggregates.
- Large event bursts.
- Middleware execution.
- Late subscriber registration.
- Duplicate subscription rejection.

The Transactional Outbox verification covers:

- Rollback safety.
- Crash recovery after commit.
- Duplicate relay worker lease exclusion.
- Lease expiration recovery.
- Retry exhaustion and dead-letter creation.
- Replay of selected events.
- Per-aggregate ordering.
- Large backlog relay.
- Concurrent publication across mixed aggregates.
- Logical exactly-once publication markers.

The Redis Event Distribution verification covers:

- Stream routing.
- Batch publishing.
- Consumer group initialization.
- Acknowledgement.
- Pending recovery.
- Dead-letter routing.
- Duplicate consumer load balancing.
- Large backlog publishing.
- Heartbeat health checks.

The Realtime Gateway verification covers:

- 100+ simultaneous connections.
- Multi-tab-style fan-out.
- Unauthorized channel rejection.
- Reconnect acknowledgement.
- Redis stream consumption.
- Redis acknowledgement.
- Burst event delivery.
- Slow-client backpressure.
- Heartbeat cleanup.
- Graceful shutdown.

The Behavior Intelligence verification covers:

- Contest reconstruction.
- Interrupted sessions.
- Duplicate telemetry.
- Feature extractor plugin registration.
- Confidence validation.
- Historical aggregation.
- Behavior profile aggregation.
- 100k telemetry event reconstruction.

The Behavior Knowledge verification covers:

- Rule plugin registration and duplicate-rule rejection.
- Strength, weakness, and pattern insight generation.
- Confidence bounds.
- Knowledge graph node and edge construction.
- Pattern detection.
- Contradictory feature handling.
- Historical consistency.
- 50k-feature synthetic inference performance.

The Retrieval Planner verification covers:

- Single-intent classification.
- Multi-intent classification.
- Unknown question handling.
- Ambiguous question handling.
- Evidence request planning.
- Trend and goal-planning questions.
- Planner rule registration and duplicate rejection.
- Deterministic planning.
- 1000 mixed questions and latency bounds.

The Hybrid Retrieval verification covers:

- Parallel source execution.
- Knowledge graph and evidence source retrieval through adapters.
- Cache effectiveness.
- Partial source failure tolerance.
- Timeout handling.
- Contradiction detection.
- Fusion correctness.
- Ranking stability.
- Deterministic evidence packages.
- 1000 mixed retrieval plans and latency bounds.

The Reasoning Context verification covers:

- 1000 Evidence Packages.
- Ontology mapping.
- Finding extraction.
- Causal chain construction.
- Contradiction handling.
- Evidence compression.
- Token budgeting for 4k and larger contexts.
- Provider-independent prompt generation.
- Prompt determinism.
- Large Evidence Packages.

The AI Task Orchestrator verification covers:

- 1000 mixed questions.
- Task routing.
- Multi-task routing.
- Task chaining.
- Strategy selection.
- Output schema selection.
- Safety and evaluation policy attachment.
- Unknown task fallback.
- Deterministic routing.
- Latency bounds.

The LLM Runtime verification covers:

- 1000 execution plans.
- Non-streaming invocation.
- Streaming chunk buffering.
- Retry handling.
- Provider failover.
- Manual model overrides.
- Rate limit rejection.
- Cancellation.
- Model selection.
- Token accounting.
- Cost accounting.
- Mixed providers.

The AI Quality Layer verification covers:

- 1000 raw responses.
- Malformed response deterministic repair.
- Schema validation.
- Grounding failure detection.
- Citation fabrication detection.
- Recommendation support validation.
- Confidence clamping.
- Consistency checks.
- Reflection creation.
- Human feedback normalization.
- Regeneration request policy.
- Deterministic validation for identical inputs.

The AI Design System verification covers:

- Required component, token, theme, layout, story, and animation files.
- Design token group coverage.
- Reduced motion CSS.
- Keyboard focus styling.
- Skeleton and streaming animation classes.
- Storybook story exports.
- Presentational boundary checks for no API calls, storage reads, or backend coupling.

## Recovery Testing

### Browser Restart

Use the runtime harness:

```powershell
cd extension
node tests/observability-runtime-verification.mjs
```

The harness seeds a new SDK instance with previous storage values and calls `recoverUnfinishedSessions`.

### Storage Recovery

The harness seeds invalid shapes for:

- `observability.sessions`
- `observability.events`
- `observability.queue`
- `observability.tabIndex`

Pass criteria: invalid shapes are reset to safe defaults.

### Duplicate Session Tests

The harness opens the same contest twice and verifies only one session exists.

### Cross-Tab Synchronization

The harness attaches two tab ids to the same contest, closes one, and verifies ownership remains with the surviving tab.

### Offline Mode

Current offline behavior is represented by queued local transport. Events are persisted to the durable local queue without backend upload.

Pass criteria:

- Event queue persists emitted events.
- Collectors do not perform network calls.

## Chrome Manual Runtime Test

1. Load the extension unpacked from `extension/`.
2. Open a Codeforces contest URL.
3. Inspect service worker logs.
4. Open a problem page in the same contest.
5. Refresh the page.
6. Open the same contest in another tab.
7. Close one tab.
8. Inspect Chrome storage for observability keys.

Pass criteria:

- A single session exists per contest.
- Problem events are emitted.
- Refresh emits reload behavior.
- Tab close does not create a duplicate session.

## Future Integration Testing

Future work should add:

- Backend service unit tests.
- API integration tests with a test database.
- Migration tests in CI.
- Extension end-to-end tests with Playwright.
- End-to-end telemetry ingestion tests against a migrated test database.
- Security regression tests for token rotation and extension message validation.

## Related Documentation

- [Observability SDK](architecture/observability-sdk.md)
- [Telemetry](architecture/telemetry.md)
- [Domain Event Bus](architecture/domain-event-bus.md)
- [Transactional Outbox](architecture/transactional-outbox.md)
- [Redis Event Distribution](architecture/redis-event-distribution.md)
- [WebSocket Gateway](architecture/websocket-gateway.md)
- [Behavior Intelligence](architecture/behavior-intelligence.md)
- [Feature Extraction](architecture/feature-extraction.md)
- [Behavior Knowledge](architecture/behavior-knowledge.md)
- [Insight Engine](architecture/insight-engine.md)
- [Intent Classification](architecture/intent-classification.md)
- [Retrieval Planner](architecture/retrieval-planner.md)
- [Hybrid Retrieval](architecture/hybrid-retrieval.md)
- [Evidence Fusion](architecture/evidence-fusion.md)
- [Behavior Ontology](architecture/behavior-ontology.md)
- [Reasoning Context Engine](architecture/reasoning-context-engine.md)
- [Prompt Orchestration](architecture/prompt-orchestration.md)
- [AI Task Orchestrator](architecture/task-orchestrator.md)
- [Prompt Strategy Engine](architecture/prompt-strategy-engine.md)
- [Output Schema Registry](architecture/output-schema-registry.md)
- [Safety Policy Engine](architecture/safety-policy-engine.md)
- [LLM Runtime](architecture/llm-runtime.md)
- [Provider Registry](architecture/provider-registry.md)
- [Model Selection](architecture/model-selection.md)
- [Runtime Observability](architecture/runtime-observability.md)
- [Response Validation](architecture/response-validation.md)
- [Grounding Engine](architecture/grounding-engine.md)
- [Quality Evaluation](architecture/quality-evaluation.md)
- [Reflection Memory](architecture/reflection-memory.md)
- [Human Feedback](architecture/human-feedback.md)
- [AI Design System](frontend/ai-design-system.md)
- [AI Design Tokens](frontend/design-tokens.md)
- [AI Component Library](frontend/component-library.md)
- [AI Accessibility](frontend/accessibility.md)
- [Operations](OPERATIONS.md)
- [Security](SECURITY.md)
