---
id: T03
parent: S01
milestone: M001
key_files:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/api-client.test.ts
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T05:19:24.667Z
blocker_discovered: false
---

# T03: Added three MCP tools that expose async LLM-as-a-Judge evaluators: foxhound_list_evaluators shows all configured evaluators with settings, foxhound_run_evaluator triggers async runs with 1-50 trace IDs, and foxhound_get_evaluator_run checks run status with emoji-formatted state (⏳ pending/running, ✅ completed, ❌ failed)

**Added three MCP tools that expose async LLM-as-a-Judge evaluators: foxhound_list_evaluators shows all configured evaluators with settings, foxhound_run_evaluator triggers async runs with 1-50 trace IDs, and foxhound_get_evaluator_run checks run status with emoji-formatted state (⏳ pending/running, ✅ completed, ❌ failed)**

## What Happened

Implemented three MCP tools wrapping the existing API client evaluator methods (listEvaluators(), triggerEvaluatorRuns(), getEvaluatorRun()). foxhound_list_evaluators takes no parameters and formats results as a markdown table with columns: ID, Name, Model, Scoring Type, and Enabled (with ✅/❌ checkmarks). Empty state returns "No evaluators configured." foxhound_run_evaluator validates trace_ids array length (1-50 via Zod schema), calls the API, and returns a list of queued run IDs with their initial status. Includes a prominent note reminding users that evaluator runs are async and they need to use foxhound_get_evaluator_run to check progress. foxhound_get_evaluator_run fetches run details and formats the status with contextual emoji: ⏳ for pending/running, ✅ for completed, ❌ for failed. Shows run ID, evaluator ID, trace ID, score ID (if completed), error message (if failed), and creation/completion timestamps. For completed runs with a score ID, includes a tip to use foxhound_get_trace_scores to view score details. All three tools follow the established error-handling pattern from prior tasks: try-catch blocks that surface API errors with context. Added comprehensive unit tests covering all status states (pending, running, completed, failed), multiple traces in one trigger, empty evaluator lists, auth failures (401), and missing resource errors (404). The initial verification failure was due to using the wrong test filter flag (--grep instead of -t), which was corrected during execution.

## Verification

Ran test suite with pattern filter to verify evaluator tools: pnpm --filter @foxhound-ai/mcp-server test -- -t "evaluator tools" — all 14 tests passed; pnpm --filter @foxhound-ai/mcp-server test — all 47 tests passed (evaluator + scoring + failure analysis + API client); pnpm --filter @foxhound-ai/mcp-server build — TypeScript compilation succeeded with no errors. The tests verify listEvaluators() returns correct table format with all fields, triggerEvaluatorRuns() sends correct payload for single and multiple traces, getEvaluatorRun() handles all four status states correctly (pending, running, completed with scoreId, failed with error), error handling for 404 (missing evaluator/run) and 401 (auth failure), and auth headers are included in all requests.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @foxhound-ai/mcp-server test -- -t "evaluator tools"` | 0 | ✅ pass | 354ms |
| 2 | `pnpm --filter @foxhound-ai/mcp-server test` | 0 | ✅ pass | 363ms |
| 3 | `pnpm --filter @foxhound-ai/mcp-server build` | 0 | ✅ pass | 2000ms |

## Deviations

The initial verification command used --grep "evaluator tools" which is not valid in Vitest. Corrected to -t "evaluator tools" (the --testNamePattern flag) during execution. This is a minor tooling mismatch, not a plan deviation.

## Known Issues

None.

## Files Created/Modified

- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/api-client.test.ts`
