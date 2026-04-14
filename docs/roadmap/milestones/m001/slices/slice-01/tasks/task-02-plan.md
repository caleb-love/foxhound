---
estimated_steps: 13
estimated_files: 2
skills_used: []
---

# T02: Add scoring tools (score_trace + get_trace_scores)

Wrap existing API client scoring methods with two MCP tools that expose score creation and querying from the IDE. These tools directly advance R007 (scores attachable to any trace/span).

**foxhound_score_trace:**
- Input schema: `trace_id` (string, required), `span_id` (string, optional), `name` (string, required), `value` (number, optional), `label` (string, optional), `comment` (string, optional), `confirm` (boolean, optional)
- Preview mode (confirm !== true): Return formatted message showing what score will be created with all parameters
- Execute mode (confirm === true): Call `api.createScore({ traceId, spanId, name, value, label, source: "manual", comment })` and return success message with score ID
- Source is always "manual" for IDE-created scores
- Follow existing confirm pattern from delete tools

**foxhound_get_trace_scores:**
- Input schema: `trace_id` (string, required)
- Call `api.getTraceScores(traceId)`
- Format results as markdown table with columns: Score Name, Value/Label, Source, Comment
- Handle empty results gracefully ("No scores found for this trace")
- Include count in header

## Inputs

- ``packages/api-client/src/index.ts` — `createScore()` and `getTraceScores()` methods`
- ``packages/types/src/index.ts` — `Score` interface`
- ``packages/mcp-server/src/index.ts` — existing confirm pattern from delete tools`

## Expected Output

- ``packages/mcp-server/src/index.ts` — two new tool registrations: `foxhound_score_trace` and `foxhound_get_trace_scores``
- ``packages/mcp-server/src/api-client.test.ts` — unit tests for score tool wrappers with confirm pattern and empty results`

## Verification

pnpm --filter @foxhound-ai/mcp-server test -- --grep "scoring tools"

## Observability Impact

Signals added: MCP tool success/error responses for score creation/querying
How a future agent inspects this: Call `foxhound_get_trace_scores` with a trace ID to see all scores
Failure state exposed: API errors (404 for missing trace, 401 for auth, 500 for server errors) propagate with status codes
