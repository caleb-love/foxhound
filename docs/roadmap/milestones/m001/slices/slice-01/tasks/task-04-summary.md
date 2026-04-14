---
id: T04
parent: S01
milestone: M001
key_files:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/api-client.test.ts
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T05:24:09.109Z
blocker_discovered: false
---

# T04: Added three MCP tools that expose dataset operations: foxhound_list_datasets shows all datasets with item counts in a markdown table, foxhound_add_trace_to_dataset extracts root span attributes as input with preview/confirm pattern, and foxhound_curate_dataset auto-adds traces to datasets based on score criteria (name/operator/threshold)

**Added three MCP tools that expose dataset operations: foxhound_list_datasets shows all datasets with item counts in a markdown table, foxhound_add_trace_to_dataset extracts root span attributes as input with preview/confirm pattern, and foxhound_curate_dataset auto-adds traces to datasets based on score criteria (name/operator/threshold)**

## What Happened

Implemented the three dataset tools and helper function as specified:

1. **Helper function `extractTraceInput(trace: Trace)`** — Extracts root span attributes (first span with no parentSpanId) as dataset input, converting span.attributes to Record<string, unknown>. Falls back to trace.metadata if no root spans exist. Handles edge cases: multiple root spans (uses first), empty attributes, and missing root spans.

2. **foxhound_list_datasets** — Fetches all datasets via `api.listDatasets()`, then calls `api.getDataset(id)` for each to get item counts. Returns markdown table with columns: ID, Name, Description, Item Count. Handles empty results with "No datasets found." message. Gracefully handles failures when fetching individual dataset counts by using 0 as fallback.

3. **foxhound_add_trace_to_dataset** — Implements preview/confirm pattern matching existing delete tools. Preview mode (confirm !== true) fetches trace, extracts input via helper, shows formatted JSON preview of input/expectedOutput/metadata. Execute mode (confirm === true) calls `api.createDatasetItem()` with extracted input and returns success message with item ID and input field count.

4. **foxhound_curate_dataset** — Wraps `api.createDatasetItemsFromTraces()` with score filtering. Accepts dataset_id, score_name, operator (lt/gt/lte/gte), threshold, optional since_days and limit. Returns formatted message showing count of items added and filter criteria with operator symbol (</>/<=/>=).

Added comprehensive test coverage including:
- API client method wrappers for listDatasets, getDataset, createDatasetItem, createDatasetItemsFromTraces
- Edge cases for extractTraceInput helper: root span extraction, multiple root spans (uses first), no root span (metadata fallback), empty attributes
- Error handling for 400 on invalid operator/threshold, 404 for missing dataset/trace

Fixed verification command syntax — the task plan specified `--grep` (Mocha syntax) but Vitest uses `-t` for test name pattern matching.

## Verification

Ran test suite with correct Vitest syntax: `pnpm --filter @foxhound-ai/mcp-server test -t "dataset tools"`

All 60 tests passed, including:
- 10 new dataset tool tests covering API client wrappers, input extraction, edge cases, and error handling
- 5 extractTraceInput helper tests covering root span extraction, multiple root spans, metadata fallback, empty attributes

TypeScript compilation passed with no errors.

All three tools registered correctly in the MCP server (verified 31 total tools with `grep -c "server.tool"`).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @foxhound-ai/mcp-server test -t "dataset tools"` | 0 | ✅ pass | 332ms |
| 2 | `pnpm --filter @foxhound-ai/mcp-server test -t "evaluator tools"` | 0 | ✅ pass | 320ms |
| 3 | `pnpm --filter @foxhound-ai/mcp-server build` | 0 | ✅ pass | 1000ms |

## Deviations

**Verification command syntax correction** — Task plan specified `pnpm --filter @foxhound-ai/mcp-server test -- --grep "dataset tools"` using Mocha's `--grep` option, but the project uses Vitest which requires `-t` instead. Corrected to `pnpm --filter @foxhound-ai/mcp-server test -t "dataset tools"`.

This is not a plan deviation — the intended verification (running dataset tool tests) was executed correctly with the proper syntax for the actual test framework in use.

## Known Issues

None.

## Files Created/Modified

- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/api-client.test.ts`
