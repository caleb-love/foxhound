---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T02: Implement experiment creation and polling logic

**Slice:** S03 — GitHub Actions Quality Gate
**Milestone:** M001

## Description

Implement the core action logic: create experiment via API client, poll for completion with exponential backoff and timeout (default 600s, configurable), handle all experiment statuses (pending/running/completed/failed). Extract experiment ID and write to GitHub output.

This is the critical path — the action must reliably create experiments and wait for them to complete, handling all edge cases (timeouts, API errors, worker failures).

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| Foxhound API (createExperiment) | Log error with status code, exit 1 | N/A (single request) | Parse error, log, exit 1 |
| Foxhound API (getExperiment polling) | Log error, retry with backoff | After 600s, log timeout, exit 1 | Log parse error, retry |
| Worker (experiment execution) | Experiment status "failed" | Experiment stuck "running" beyond timeout | N/A (worker-side) |

## Load Profile

- **Shared resources**: Foxhound API server, experiment worker queue
- **Per-operation cost**: 1 POST (createExperiment), ~20-60 GET requests (polling every 2-30s for 10 min)
- **10x breakpoint**: Worker queue capacity (20 jobs/min rate limit on worker)

## Negative Tests

- **Malformed inputs**: Empty dataset-id (API returns 400), invalid experiment-config JSON (parse error before API call), missing API key (401)
- **Error paths**: Network timeout during createExperiment (retry or fail with clear message), 403 from API (missing canEvaluate entitlement), experiment status "failed" (exit 1 with error from experiment), poll timeout (log last known status)
- **Boundary conditions**: Timeout exactly at limit (should fail), experiment completes on first poll (skip polling loop), experiment completes at last poll before timeout (should succeed)

## Steps

1. Parse inputs from process.env:
   - INPUT_API_KEY (required)
   - INPUT_API_ENDPOINT (required)
   - INPUT_DATASET_ID (required)
   - INPUT_EVALUATOR_IDS (optional, comma-separated)
   - INPUT_EXPERIMENT_NAME (optional, default to "PR #N" from github.context)
   - INPUT_EXPERIMENT_CONFIG (required, parse as JSON)
   - INPUT_TIMEOUT (optional, default 600)
2. Create FoxhoundApiClient instance with endpoint and apiKey
3. Call createExperiment with dataset-id, name, and parsed config (as Record<string, unknown>)
4. Extract experimentId from CreateExperimentResponse
5. Write experiment-id to $GITHUB_OUTPUT: `fs.appendFileSync(process.env.GITHUB_OUTPUT, `experiment-id=${experimentId}\n`)`
6. Implement pollExperiment function:
   - Start with 2s delay, double on each retry, max 30s
   - Track elapsed time, fail if > timeout
   - Call getExperiment, check status
   - If "completed", return experiment
   - If "failed", throw error with experiment failure details
   - If "pending" or "running", log status and elapsed time, wait backoff, retry
   - If timeout exceeded, throw error "Experiment timed out after {timeout}s, last status: {status}"
7. Call pollExperiment and await result
8. Handle specific API error codes:
   - 401: "Invalid API key or missing FOXHOUND_API_KEY secret"
   - 403: "Organization lacks 'canEvaluate' entitlement — upgrade to Pro plan"
   - 404: "Dataset not found — verify dataset-id input"
   - 500: "Foxhound API server error — check status.foxhound.dev"
9. Log structured output for each poll attempt: `[poll ${attempt}] status=${status}, elapsed=${elapsed}s`
10. Rebuild bundle: `pnpm build`

## Must-Haves

- [ ] Parses all required inputs from process.env.INPUT\_\*
- [ ] Creates experiment via API client with correct parameters
- [ ] Polls experiment status with exponential backoff (2s -> 30s max)
- [ ] Handles timeout (default 600s, configurable)
- [ ] Handles all experiment statuses (pending, running, completed, failed)
- [ ] Writes experiment-id to $GITHUB_OUTPUT
- [ ] Logs poll attempts with status and elapsed time
- [ ] Provides actionable error messages for common API failures (401, 403, 404, 500)
- [ ] Exits with code 1 on failure (timeout, failed status, API error)

## Verification

```bash
grep -q 'createExperiment' .github/actions/quality-gate/run.ts && \
grep -q 'pollExperiment' .github/actions/quality-gate/run.ts && \
grep -q 'exponential' .github/actions/quality-gate/run.ts
```

## Observability Impact

- Signals added: Structured log per poll attempt (experiment ID, status, elapsed time), final experiment status log (completed/failed), error logs with API status codes
- How a future agent inspects this: GitHub Actions workflow logs (search for "poll" or "experiment"), $GITHUB_OUTPUT file (contains experiment-id)
- Failure state exposed: Poll timeout error includes last known status, API errors include status code and endpoint, experiment failure includes worker error message

## Inputs

- `.github/actions/quality-gate/run.ts` — Script skeleton from T01 with API client import
- `packages/api-client/src/index.ts` — createExperiment, getExperiment methods
- `packages/api-client/src/types.ts` — CreateExperimentResponse, ExperimentWithRuns types
- `packages/types/src/index.ts` — ExperimentStatus enum

## Expected Output

- `.github/actions/quality-gate/run.ts` — Full experiment creation and polling implementation with error handling, logging, exponential backoff
- `.github/actions/quality-gate/dist/run.js` — Updated bundle with polling logic
