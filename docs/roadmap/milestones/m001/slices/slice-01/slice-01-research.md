# S01 Research: MCP Server Enhancement

## Requirements Traceability Mapping

| Requirement | How S01 Supports It |
|---|---|
| **R007** — Scores attachable to any trace or span | New `foxhound_score_trace` and `foxhound_get_trace_scores` tools expose score creation/querying from IDE |
| **R008** — LLM-as-a-Judge async without blocking API | New `foxhound_run_evaluator` triggers async evaluator runs; `foxhound_get_evaluator_run` polls status |
| **R010** — Datasets auto-curable from production traces | New `foxhound_add_trace_to_dataset` and `foxhound_curate_dataset` tools enable dataset building from IDE |
| **R011** — Experiments with auto-scoring | Indirectly supported — evaluator tools let users trigger scoring that feeds into experiment comparisons |

## Current State

### MCP Server (`packages/mcp-server/src/index.ts`, 744 lines)

Single-file MCP server with **21 tools** registered via `server.tool()`. Uses `@modelcontextprotocol/sdk` v1.29.0 (installed) with `^1.12.0` in package.json. Connects via stdio transport.

**Existing tools by category:**

| Category | Tools | Count |
|---|---|---|
| Trace inspection | `search_traces`, `get_trace`, `replay_span`, `diff_runs`, `get_anomalies` | 5 |
| Cost/Usage | `get_cost_summary`, `status` | 2 |
| Alert rules | `list_alert_rules`, `create_alert_rule`, `delete_alert_rule` | 3 |
| Notification channels | `list_channels`, `create_channel`, `test_channel`, `delete_channel` | 4 |
| API keys | `list_api_keys`, `create_api_key`, `revoke_api_key` | 3 |
| Agent intelligence | `get_agent_budget`, `check_sla_status`, `detect_regression`, `list_baselines` | 4 |

**What's NOT exposed yet:** Scores, evaluators, datasets, experiments, annotation queues. The API client methods for all of these already exist.

### API Client (`packages/api-client/src/index.ts`, 598 lines)

Full typed HTTP client shared by CLI and MCP server. Every method needed for the new tools already exists:

**Scores:**
- `createScore(params)` — POST `/v1/scores` — creates a score on a trace/span
- `queryScores(params?)` — GET `/v1/scores` — filters by traceId, name, source, value range
- `getTraceScores(traceId)` — GET `/v1/traces/:id/scores` — all scores for a trace
- `deleteScore(scoreId)` — DELETE `/v1/scores/:id`

**Evaluators:**
- `listEvaluators()` — GET `/v1/evaluators` — all evaluators in org
- `getEvaluator(id)` — GET `/v1/evaluators/:id`
- `triggerEvaluatorRuns(params)` — POST `/v1/evaluator-runs` — triggers async runs on trace IDs
- `getEvaluatorRun(runId)` — GET `/v1/evaluator-runs/:id` — check run status/result

**Datasets:**
- `listDatasets()` — GET `/v1/datasets`
- `getDataset(id)` — GET `/v1/datasets/:id` — includes `itemCount`
- `createDatasetItem(datasetId, params)` — POST `/v1/datasets/:id/items` — single item with optional `sourceTraceId`
- `createDatasetItemsFromTraces(datasetId, params)` — POST `/v1/datasets/:id/items/from-traces` — bulk auto-curation by score threshold

### Types (`packages/types/src/index.ts`)

All domain types are well-defined:
- `Score`: id, orgId, traceId, spanId?, name, value?, label?, source (manual|llm_judge|sdk|user_feedback), comment?
- `Evaluator`: id, name, promptTemplate, model, scoringType (numeric|categorical), labels[], enabled
- `EvaluatorRun`: id, evaluatorId, traceId, scoreId?, status (pending|running|completed|failed), error?
- `Dataset`: id, name, description?
- `DatasetItem`: id, datasetId, input, expectedOutput?, metadata?, sourceTraceId?

### Package Distribution

- Published as `@foxhound-ai/mcp-server` on npm
- Binary: `foxhound-mcp` (via `bin` in package.json)
- Install: `npx @foxhound/mcp-server` or `claude mcp add foxhound -- npx @foxhound/mcp-server`
- Auth via env vars: `FOXHOUND_API_KEY`, `FOXHOUND_ENDPOINT`

### Test Coverage

Single test file (`packages/mcp-server/src/api-client.test.ts`, 110 lines) — tests the API client calls (URL construction, auth headers, error handling). No tests for tool registration or tool handler logic.

## New Tools to Build

### Category 1: Failure Analysis (client-side, no new API endpoints)

**`foxhound_explain_failure`** — Analyze a trace and produce a human-readable failure explanation.
- Input: `trace_id` (string)
- Implementation: Call `api.getTrace()`, find error spans, extract error events from `span.events`, format error chain with span context (name, kind, attributes, duration). Walk the span tree to show the causal chain from root to error.
- Output: Structured markdown with error summary, affected span chain, error details, and timing.

**`foxhound_suggest_fix`** — Given a trace with failures, suggest remediation based on error patterns.
- Input: `trace_id` (string)
- Implementation: Call `api.getTrace()`, classify errors (timeout, auth failure, rate limit, tool error, LLM error, validation error), map to common fix patterns. This is heuristic-based pattern matching on span attributes and error messages.
- Output: Categorized suggestions (retry with backoff, check API key, increase timeout, fix prompt, etc.).

> **Design decision:** These two could be a single tool with a `mode` param, but separate tools have better discoverability in MCP tool listings. Keep them separate.

### Category 2: Scoring (wraps existing API client methods)

**`foxhound_score_trace`** — Attach a score to a trace or span.
- Input: `trace_id` (string, required), `span_id` (string, optional), `name` (string), `value` (number, optional), `label` (string, optional), `comment` (string, optional)
- Implementation: Call `api.createScore({ traceId, spanId, name, value, label, source: "manual", comment })`
- Source is always `"manual"` when scoring from IDE.

**`foxhound_get_trace_scores`** — Get all scores for a trace.
- Input: `trace_id` (string)
- Implementation: Call `api.getTraceScores(traceId)`
- Output: Formatted list of scores with name, value/label, source, comment.

### Category 3: Evaluators (wraps existing API client methods)

**`foxhound_list_evaluators`** — List available evaluators.
- Input: none
- Implementation: Call `api.listEvaluators()`
- Output: Table of evaluators with id, name, model, scoringType, enabled status.

**`foxhound_run_evaluator`** — Trigger an evaluator run on one or more traces.
- Input: `evaluator_id` (string), `trace_ids` (string array, 1-50)
- Implementation: Call `api.triggerEvaluatorRuns({ evaluatorId, traceIds })`
- Output: List of queued run IDs with status. Mention runs are async — use `foxhound_get_evaluator_run` to check results.

**`foxhound_get_evaluator_run`** — Check the status and result of an evaluator run.
- Input: `run_id` (string)
- Implementation: Call `api.getEvaluatorRun(runId)`
- Output: Run status, score result if completed, error if failed.

### Category 4: Datasets (wraps existing API client methods)

**`foxhound_list_datasets`** — List all datasets in the org.
- Input: none
- Implementation: Call `api.listDatasets()`
- Output: Table of datasets with id, name, description, item count (via subsequent `getDataset` calls or just list).

**`foxhound_add_trace_to_dataset`** — Add a single trace to a dataset as a new dataset item.
- Input: `dataset_id` (string), `trace_id` (string), `expected_output` (JSON object, optional), `metadata` (JSON object, optional)
- Implementation: Call `api.getTrace(traceId)` to extract input from trace attributes, then `api.createDatasetItem(datasetId, { input: extractedInput, expectedOutput, metadata, sourceTraceId: traceId })`
- The input extraction needs a helper: pull the root span's attributes as the "input" (or the trace metadata).

**`foxhound_curate_dataset`** — Auto-add traces to a dataset based on score thresholds.
- Input: `dataset_id` (string), `score_name` (string), `operator` (lt|gt|lte|gte), `threshold` (number), `since_days` (number, optional), `limit` (number, optional)
- Implementation: Call `api.createDatasetItemsFromTraces(datasetId, { scoreName, scoreOperator, scoreThreshold, sinceDays, limit })`
- Output: Number of items added.

## Architecture

### File Structure

The current `index.ts` is 744 lines with all 21 tools inline. Adding ~10 more tools would push it past 1100 lines. The planner should consider whether to:

1. **Keep single file** — simplest, consistent with current pattern, all tools in one place. Acceptable at ~1100 lines for a server that's just tool registrations.
2. **Extract tool groups into modules** — `tools/traces.ts`, `tools/scores.ts`, `tools/evaluators.ts`, `tools/datasets.ts`, `tools/analysis.ts`. Import and register in `index.ts`. Better organization but more files.

**Recommendation:** Keep single file. Each tool is ~20-40 lines of self-contained handler code. The file is declarative (tool registrations), not complex logic. Splitting adds import ceremony without meaningful benefit at this scale.

### Pattern to Follow

Every existing tool follows this pattern:
```typescript
server.tool(
  "foxhound_<name>",        // prefixed name
  "Description string.",     // human-readable description
  { /* zod schema */ },      // input params
  async (params) => {        // handler
    const data = await api.someMethod(params.whatever);
    return { content: [{ type: "text", text: formatResult(data) }] };
  },
);
```

Write operations use a `confirm` pattern (preview without confirm, execute with `confirm: true`). The new scoring and dataset tools should follow this for write operations.

### Error Handling

Existing tools use two patterns:
1. **No try/catch** — let errors propagate to MCP SDK error handling (used by most read-only tools)
2. **Try/catch with formatted error** — used by Phase 4 tools (budgets, SLAs, regressions) to give specific error messages

New tools should use try/catch for better IDE error messages, consistent with Phase 4 pattern.

## Risks and Constraints

1. **Failure analysis is heuristic** — `explain_failure` and `suggest_fix` are pattern-matching on error messages and span attributes. Quality depends on how well spans are instrumented. Start with common patterns (timeout, auth, rate limit, tool_call errors) and iterate.

2. **Input extraction for datasets** — When adding a trace to a dataset, we need to decide what constitutes the "input". Options: (a) trace metadata, (b) root span attributes, (c) first LLM call's input. Recommend (b) root span attributes as default, with optional override param.

3. **Tool count** — Going from 21 to ~31 tools. MCP clients list all tools in their tool picker. Some clients (Cursor, Windsurf) may have UX concerns with 30+ tools. Not a blocker — Foxhound's tools are well-namespaced with `foxhound_` prefix.

4. **No new API endpoints needed** — All required API client methods exist. This is purely an MCP-layer enhancement.

## Verification Strategy

1. **TypeScript compilation** — `pnpm --filter @foxhound-ai/mcp-server typecheck` must pass
2. **Unit tests** — Add tests for new tool handler logic (especially `explain_failure` and `suggest_fix` heuristics)
3. **Integration test** — Start MCP server, invoke tools via MCP SDK client, verify responses. Can use mock fetch like existing tests.
4. **Manual smoke test** — `FOXHOUND_API_KEY=... npx tsx packages/mcp-server/src/index.ts` and use `claude mcp add` to test in Claude Code.

## Skill Suggestions

The following professional skills may be useful for implementors:

- **`0xdarkmatter/claude-mods@mcp-patterns`** (24 installs) — MCP development patterns
  Install: `npx skills add 0xdarkmatter/claude-mods@mcp-patterns`

- **`modelcontextprotocol/ext-apps@create-mcp-app`** (787 installs) — MCP app scaffolding (less relevant since server already exists)

## Start Here

**`packages/mcp-server/src/index.ts`** — This is the only file that needs code changes. All new tools are registered here following the existing pattern. The API client methods are ready; this is wiring work.

**Riskiest piece:** The `explain_failure` and `suggest_fix` tools require heuristic analysis logic that doesn't exist anywhere in the codebase yet. Build and test these first. The remaining tools (scores, evaluators, datasets) are straightforward wrappers around existing API client methods.

## Task Decomposition Hints

Natural task boundaries:
1. **T01: Failure analysis tools** — `explain_failure` + `suggest_fix` (most complex, new logic)
2. **T02: Score tools** — `score_trace` + `get_trace_scores` (simple wrappers)
3. **T03: Evaluator tools** — `list_evaluators` + `run_evaluator` + `get_evaluator_run` (simple wrappers)
4. **T04: Dataset tools** — `list_datasets` + `add_trace_to_dataset` + `curate_dataset` (medium — needs input extraction helper)
5. **T05: Tests** — Unit tests for all new tools, especially failure analysis heuristics

Tasks T02-T04 are independent of each other and T01. T05 depends on all others.
