---
estimated_steps: 20
estimated_files: 2
skills_used: []
---

# T03: Add evaluator tools (list + run + get_run)

Wrap existing API client evaluator methods with three MCP tools that expose async LLM-as-a-Judge from the IDE. These tools advance R008 (async evaluator runs without blocking).

**foxhound_list_evaluators:**
- No input params required
- Call `api.listEvaluators()`
- Format results as markdown table with columns: ID, Name, Model, Scoring Type, Enabled
- Include count in header
- Handle empty results ("No evaluators configured")

**foxhound_run_evaluator:**
- Input schema: `evaluator_id` (string, required), `trace_ids` (array of strings, required, min 1, max 50)
- Validate trace_ids array length (1-50)
- Call `api.triggerEvaluatorRuns({ evaluatorId, traceIds })`
- Return list of queued run IDs with their initial status
- Include prominent note: "Evaluator runs are async. Use `foxhound_get_evaluator_run` with a run ID to check status and results."
- Format as markdown list with run ID and trace ID pairs

**foxhound_get_evaluator_run:**
- Input schema: `run_id` (string, required)
- Call `api.getEvaluatorRun(runId)`
- Format result showing: Run ID, Evaluator ID, Trace ID, Status, Score ID (if completed), Error (if failed), Created At, Completed At (if done)
- Use different formatting based on status: pending/running → "⏳ In progress", completed → "✅ Complete", failed → "❌ Failed"
- For completed runs, include score details if scoreId is present

## Inputs

- ``packages/api-client/src/index.ts` — `listEvaluators()`, `triggerEvaluatorRuns()`, `getEvaluatorRun()` methods`
- ``packages/types/src/index.ts` — `Evaluator`, `EvaluatorRun`, `EvaluatorRunStatus` interfaces`

## Expected Output

- ``packages/mcp-server/src/index.ts` — three new tool registrations: `foxhound_list_evaluators`, `foxhound_run_evaluator`, `foxhound_get_evaluator_run``
- ``packages/mcp-server/src/api-client.test.ts` — unit tests for evaluator tool wrappers covering all status states (pending, running, completed, failed)`

## Verification

pnpm --filter @foxhound-ai/mcp-server test -- --grep "evaluator tools"

## Observability Impact

Signals added: MCP tool responses showing evaluator run status transitions (pending → running → completed/failed)
How a future agent inspects this: Call `foxhound_get_evaluator_run` with a run ID to check current status
Failure state exposed: Run status "failed" with error message, API errors (404 for missing run/evaluator) propagate with status
