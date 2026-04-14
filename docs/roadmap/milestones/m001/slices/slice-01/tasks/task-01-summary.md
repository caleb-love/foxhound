---
id: T01
parent: S01
milestone: M001
key_files:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/api-client.test.ts
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T05:13:05.668Z
blocker_discovered: false
---

# T01: Added two MCP tools that analyze trace failures client-side: foxhound_explain_failure shows error chains with timing/context, foxhound_suggest_fix classifies errors and provides category-specific remediation steps

**Added two MCP tools that analyze trace failures client-side: foxhound_explain_failure shows error chains with timing/context, foxhound_suggest_fix classifies errors and provides category-specific remediation steps**

## What Happened

Implemented foxhound_explain_failure and foxhound_suggest_fix as new MCP server tools. Both tools fetch traces via the existing api.getTrace() method and analyze error spans client-side without requiring new API endpoints.

foxhound_explain_failure fetches the trace, filters spans with status === "error", extracts error events from span.events where event.name === "error", builds the parent chain by walking parentSpanId references, and renders the error chain as structured markdown showing the error summary, span chain from root to failed span with indentation, error details with span context, and all other error spans if multiple failures exist.

foxhound_suggest_fix fetches the trace, finds all error spans, classifies each error using pattern matching (timeout: duration > 30s OR message contains timeout/timed out/deadline; auth: message contains unauthorized/forbidden/401/403/api key/authentication; rate limit: message contains rate limit/429/too many requests/quota; tool error: span.kind === tool_call; LLM error: span.kind === llm_call OR message contains model/openai/anthropic; validation: message contains validation/invalid/required/schema), groups errors by category, and returns structured markdown with category-specific fix suggestions.

Error messages are extracted from span.events by finding events with name === "error" and reading attributes["error.message"] or attributes["message"], falling back to "Unknown error" if neither exists. Both tools handle API fetch errors gracefully, catching exceptions and returning formatted error messages that include the trace ID and HTTP status from the API client.

## Verification

Ran test suite with 18 failure analysis tests covering error detection from span status and events, error message extraction from event attributes, pattern-based classification for all 6 error categories, parent chain building for error context, multiple error handling and earliest error selection, and edge cases (missing attributes, no events, incomplete spans). Verified TypeScript compilation succeeds with strict type checking.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @foxhound-ai/mcp-server test -- -t "failure analysis"` | 0 | ✅ pass | 382ms |
| 2 | `pnpm --filter @foxhound-ai/mcp-server build` | 0 | ✅ pass | 1000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/api-client.test.ts`
