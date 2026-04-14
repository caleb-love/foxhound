# S01: MCP Server Enhancement

**Goal:** MCP tools explain failures, suggest fixes, score traces, run evaluators, and add traces to datasets from IDE
**Demo:** MCP tools explain failures, suggest fixes, score traces, run evaluators, and add traces to datasets from IDE

## Must-Haves

- TypeScript compilation passes (`pnpm --filter @foxhound-ai/mcp-server typecheck`)
- All unit tests pass (`pnpm --filter @foxhound-ai/mcp-server test`)
- All 10 new tools are registered and callable via MCP protocol
- Failure analysis tools correctly identify error chains and classify error types
- Score, evaluator, and dataset tools successfully wrap their API client methods

## Proof Level

- This slice proves: integration

## Integration Closure

- Upstream surfaces consumed: `@foxhound/api-client` methods (createScore, getTraceScores, listEvaluators, triggerEvaluatorRuns, getEvaluatorRun, listDatasets, createDatasetItem, createDatasetItemsFromTraces), `@foxhound/types` interfaces (Score, Evaluator, EvaluatorRun, Dataset, DatasetItem)
- New wiring introduced: 10 new MCP tool registrations in `packages/mcp-server/src/index.ts`
- What remains: Manual smoke test with real MCP client (Claude Code/Cursor/Windsurf) to verify tools are usable in production IDE workflow

## Verification

- Runtime signals: MCP SDK error responses when tool invocations fail (auth, network, validation)
- Inspection surfaces: MCP client tool picker shows all 10 new tools with descriptions, MCP error messages surface API failures
- Failure visibility: Tool errors include trace ID / evaluator ID / dataset ID context, API client errors propagate with HTTP status
- Redaction constraints: API keys in env vars only, never logged or returned in tool responses

## Tasks

- [x] **T01: Add failure analysis tools (explain_failure + suggest_fix)** `est:1.5h`
  Build two new MCP tools that analyze trace failures client-side without new API endpoints. `foxhound_explain_failure` extracts error events from span trees and formats them as human-readable failure explanations with causal chains. `foxhound_suggest_fix` classifies errors (timeout, auth, rate limit, tool error, LLM error, validation) using heuristic pattern matching on span attributes and error messages, then maps each category to actionable fix suggestions. This is the riskiest piece — requires new logic that doesn't exist anywhere in the codebase yet.
  - Files: `packages/mcp-server/src/index.ts`
  - Verify: pnpm --filter @foxhound-ai/mcp-server test -- --grep "failure analysis"

- [x] **T02: Add scoring tools (score_trace + get_trace_scores)** `est:45m`
  Wrap existing API client scoring methods with two MCP tools. `foxhound_score_trace` accepts trace_id, optional span_id, name, value, label, and comment — calls `api.createScore()` with source='manual'. Uses the confirm pattern: preview without confirm, execute with confirm=true. `foxhound_get_trace_scores` accepts trace_id and calls `api.getTraceScores()`, formatting results as a table. These tools directly advance R007 (scores attachable to any trace/span) by exposing score creation and querying from the IDE.
  - Files: `packages/mcp-server/src/index.ts`
  - Verify: pnpm --filter @foxhound-ai/mcp-server test -- --grep "scoring tools"

- [x] **T03: Add evaluator tools (list + run + get_run)** `est:1h`
  Wrap existing API client evaluator methods with three MCP tools. `foxhound_list_evaluators` calls `api.listEvaluators()` and formats results as a table with id, name, model, scoringType, enabled. `foxhound_run_evaluator` accepts evaluator_id and trace_ids (1-50 array), calls `api.triggerEvaluatorRuns()`, returns queued run IDs with a note that runs are async. `foxhound_get_evaluator_run` accepts run_id, calls `api.getEvaluatorRun()`, returns status/score/error. These tools advance R008 (async LLM-as-a-Judge) by letting users trigger and poll evaluator runs from the IDE.
  - Files: `packages/mcp-server/src/index.ts`
  - Verify: pnpm --filter @foxhound-ai/mcp-server test -- --grep "evaluator tools"

- [x] **T04: Add dataset tools (list + add_trace + curate)** `est:1h`
  Wrap existing API client dataset methods with three MCP tools, including a helper for input extraction. `foxhound_list_datasets` calls `api.listDatasets()` and formats results. `foxhound_add_trace_to_dataset` accepts dataset_id, trace_id, optional expected_output and metadata — calls `api.getTrace()` to extract root span attributes as input, then `api.createDatasetItem()` with sourceTraceId. Uses confirm pattern for preview/execute. `foxhound_curate_dataset` accepts dataset_id, score_name, operator, threshold, optional since_days and limit — calls `api.createDatasetItemsFromTraces()` for bulk auto-curation. These tools advance R010 (datasets auto-curable from production traces).
  - Files: `packages/mcp-server/src/index.ts`
  - Verify: pnpm --filter @foxhound-ai/mcp-server test -- --grep "dataset tools"

## Files Likely Touched

- packages/mcp-server/src/index.ts
