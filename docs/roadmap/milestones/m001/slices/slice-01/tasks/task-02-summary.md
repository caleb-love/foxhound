---
id: T02
parent: S01
milestone: M001
key_files:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/api-client.test.ts
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T05:16:40.585Z
blocker_discovered: false
---

# T02: Added two MCP tools that wrap API client scoring methods: foxhound_score_trace creates scores with preview/confirm pattern, foxhound_get_trace_scores lists all scores for a trace in a markdown table

**Added two MCP tools that wrap API client scoring methods: foxhound_score_trace creates scores with preview/confirm pattern, foxhound_get_trace_scores lists all scores for a trace in a markdown table**

## What Happened

Implemented two MCP tools that expose score creation and querying from the IDE. The tools directly advance R007 (scores attachable to any trace/span).

**foxhound_score_trace** creates scores with a preview/confirm pattern matching the existing delete tools:
- Preview mode (confirm !== true): Shows what score will be created with all parameters
- Execute mode (confirm === true): Calls `api.createScore()` and returns success message with score ID
- Supports both trace-level and span-level scores
- Supports both numeric values (0-1) and categorical labels
- Source is always "manual" for IDE-created scores
- Optional comment field for explaining the score

**foxhound_get_trace_scores** queries all scores for a trace:
- Calls `api.getTraceScores(traceId)`
- Formats results as markdown table with columns: Score Name, Value/Label, Source, Comment
- Handles empty results gracefully ("No scores found for this trace")
- Includes score count in header
- Shows span indicator for span-level scores

The implementation correctly handles the `TraceScoresResponse` type which wraps scores in a `data` property rather than returning a direct array.

## Verification

Ran the scoring tools test suite using Vitest's `-t` flag (Vitest doesn't support `--grep`):
- `pnpm --filter @foxhound-ai/mcp-server test -t "scoring tools"` — all 33 tests passed
- Tests cover:
  - Score creation with correct URL and payload
  - Both trace-level and span-level scores
  - Value scores vs label scores
  - Empty score lists
  - Auth header inclusion
  - Error handling (404 for missing trace, 401 for auth failure)

TypeScript compilation verified via `pnpm build` — no errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @foxhound-ai/mcp-server test -t "scoring tools"` | 0 | ✅ pass | 363ms |
| 2 | `pnpm --filter @foxhound-ai/mcp-server build` | 0 | ✅ pass | 800ms |

## Deviations

Corrected verification command syntax from `--grep` to `-t` (Vitest uses `-t`/`--testNamePattern` instead of `--grep`).

## Known Issues

None.

## Files Created/Modified

- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/api-client.test.ts`
