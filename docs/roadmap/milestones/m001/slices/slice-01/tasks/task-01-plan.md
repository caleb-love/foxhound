---
estimated_steps: 31
estimated_files: 2
skills_used: []
---

# T01: Add failure analysis tools (explain_failure + suggest_fix)

Build two new MCP tools that analyze trace failures client-side without new API endpoints.

**foxhound_explain_failure:**
- Input: `trace_id` (string)
- Fetch trace via `api.getTrace()`
- Walk span tree to find error spans (status === "error")
- Extract error events from `span.events` where `event.name === "error"`
- Build a human-readable failure explanation showing:
  - Error summary (first error message)
  - Affected span chain (root → parent → failed span)
  - Error details with span context (name, kind, attributes, duration)
  - Timing information
- Format as structured markdown

**foxhound_suggest_fix:**
- Input: `trace_id` (string)
- Fetch trace via `api.getTrace()`
- Find all error spans
- Classify each error by pattern matching on span attributes and error messages:
  - **Timeout**: duration > threshold, or error message contains "timeout", "timed out", "deadline"
  - **Auth failure**: error message contains "unauthorized", "forbidden", "401", "403", "api key", "authentication"
  - **Rate limit**: error message contains "rate limit", "429", "too many requests", "quota"
  - **Tool error**: span.kind === "tool", error in span.events
  - **LLM error**: span.kind === "llm", error in span.events, or message contains "model", "openai", "anthropic"
  - **Validation error**: error message contains "validation", "invalid", "required", "schema"
- Map each category to fix suggestions:
  - Timeout → increase timeout, optimize query, add retry with backoff
  - Auth → check API key env var, verify credentials, check permissions
  - Rate limit → add exponential backoff, reduce request rate, upgrade plan
  - Tool error → check tool config, verify tool availability, inspect tool logs
  - LLM error → check prompt length, verify model name, check API quota
  - Validation → check input schema, verify required fields, inspect error details
- Format as categorized markdown list

## Inputs

- ``packages/api-client/src/index.ts` — `getTrace()` method for fetching trace data`
- ``packages/types/src/index.ts` — `Trace`, `Span`, `SpanEvent` interfaces`

## Expected Output

- ``packages/mcp-server/src/index.ts` — two new tool registrations: `foxhound_explain_failure` and `foxhound_suggest_fix``
- ``packages/mcp-server/src/api-client.test.ts` — unit tests for failure analysis heuristics and error classification`

## Verification

pnpm --filter @foxhound-ai/mcp-server test -- --grep "failure analysis"

## Observability Impact

Signals added: MCP tool error responses when trace_id is invalid or API fetch fails
How a future agent inspects this: Call the tool with a known failing trace ID, inspect returned markdown
Failure state exposed: Tool returns formatted error message with HTTP status from API client
