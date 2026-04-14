---
id: S01
parent: M001
milestone: M001
provides:
  - 10 MCP tools callable from Claude Code/Cursor/Windsurf: foxhound_explain_failure (error chain analysis), foxhound_suggest_fix (error classification + remediation), foxhound_score_trace (manual score creation), foxhound_get_trace_scores (score querying), foxhound_list_evaluators (evaluator discovery), foxhound_run_evaluator (async evaluator triggering), foxhound_get_evaluator_run (run status polling), foxhound_list_datasets (dataset discovery), foxhound_add_trace_to_dataset (manual trace addition), foxhound_curate_dataset (bulk auto-curation); All tools include auth header support, error handling, and structured markdown output; 60 unit tests covering all tools and edge cases
requires:
  []
affects:
  - S02
key_files:
  - packages/mcp-server/src/index.ts,packages/mcp-server/src/api-client.test.ts
key_decisions:
  - Use client-side error analysis instead of new API endpoints for failure explanation—reduces backend complexity and latency; Use preview/confirm pattern for all mutating dataset/scoring operations to prevent accidental data creation—matches existing delete tools UX; Classify errors using pattern matching on span attributes/messages rather than structured error codes—works with existing trace schema without backend changes; Use Vitest -t flag instead of --grep for test filtering—Vitest naming convention differs from Jest
patterns_established:
  - Preview/confirm pattern for MCP mutating operations (score_trace, add_trace_to_dataset)—preview without confirm, execute with confirm=true; Client-side trace analysis pattern for MCP tools—fetch trace via API, process in MCP server, return formatted results without new backend endpoints; Contextual emoji formatting for async job status (⏳ pending/running, ✅ completed, ❌ failed); Vitest test filtering uses -t flag instead of --grep; Error classification via pattern matching on span attributes and error messages; Bulk operations (curate_dataset) use API batch endpoints but don't expose polling mechanism—users refresh views manually
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-10T05:26:19.613Z
blocker_discovered: false
---

# S01: MCP Server Enhancement

**Added 10 new MCP tools that expose failure analysis, scoring, evaluators, and datasets from IDE with client-side intelligence and preview/confirm patterns**

## What Happened

Implemented 10 new MCP server tools across four functional areas: failure analysis, scoring, evaluators, and datasets. All tools wrap existing API client methods or perform client-side analysis without requiring new backend endpoints.

**Failure Analysis (T01):** Built two client-side analysis tools that process trace data in the MCP server. `foxhound_explain_failure` fetches traces, filters error spans, builds parent chains, and renders structured markdown showing error context with timing and span relationships. `foxhound_suggest_fix` classifies errors into six categories (timeout, auth, rate limit, tool error, LLM error, validation) using pattern matching on span attributes and error messages, then provides category-specific remediation steps. Both tools handle API fetch errors gracefully and support traces with multiple concurrent failures.

**Scoring Tools (T02):** Implemented two tools that advance R007 (scores attachable to any trace/span). `foxhound_score_trace` creates manual scores with preview/confirm pattern matching the existing delete tools—preview mode shows what will be created, execute mode (confirm=true) calls the API. Supports both trace-level and span-level scores, numeric values (0-1) and categorical labels, with optional comments. Source is always "manual" for IDE-created scores. `foxhound_get_trace_scores` queries all scores for a trace and formats results as markdown table with score name, value/label, source, and comment columns.

**Evaluator Tools (T03):** Added three tools that expose async LLM-as-a-Judge evaluators (advancing R008). `foxhound_list_evaluators` shows all configured evaluators with ID, name, model, scoring type, and enabled status. `foxhound_run_evaluator` triggers async runs with 1-50 trace IDs (Zod validation), returns queued run IDs with prominent async reminder. `foxhound_get_evaluator_run` checks run status with contextual emoji (⏳ pending/running, ✅ completed, ❌ failed), shows timestamps, score IDs for completed runs, error messages for failures, and includes tips to use foxhound_get_trace_scores for score details.

**Dataset Tools (T04):** Implemented three tools that advance R010 (datasets auto-curable from production traces). `foxhound_list_datasets` shows all datasets with item counts and metadata. `foxhound_add_trace_to_dataset` uses preview/confirm pattern, fetches trace to extract root span attributes as input, creates dataset item with sourceTraceId lineage, supports optional expected_output and metadata. `foxhound_curate_dataset` enables bulk auto-curation by score thresholds—accepts score_name, operator (>=, >, <=, <, ==, !=), threshold, optional since_days and limit, calls createDatasetItemsFromTraces for batch ingestion.

All tools follow established patterns: Zod input validation, try-catch error handling with context, structured markdown formatting, auth header inclusion, and comprehensive unit test coverage (60 tests total covering all tools, error states, auth failures, missing resources, and edge cases). Initial verification failed due to --grep flag (not supported in Vitest), corrected to -t during execution.

## Verification

TypeScript compilation passes with strict checking. All 60 unit tests pass covering failure analysis (18 tests), scoring tools (15 tests), evaluator tools (14 tests), and dataset tools (13 tests). Tests verify correct API client method calls, URL construction, payload formatting, auth header inclusion, error handling (401, 404), edge cases (empty results, missing attributes), and markdown table formatting. All 10 new tools are registered in the MCP server tools array and callable via MCP protocol.

## Requirements Traceability Advanced

None.

## Requirements Traceability Validated

- R007 — foxhound_score_trace and foxhound_get_trace_scores expose score creation and querying from IDE, enabling manual scoring workflows for any trace or span
- R008 — foxhound_list_evaluators, foxhound_run_evaluator, and foxhound_get_evaluator_run expose async evaluator triggering and status polling from IDE, enabling LLM-as-a-Judge workflows
- R010 — foxhound_add_trace_to_dataset and foxhound_curate_dataset enable both manual trace addition and bulk auto-curation from production traces via score thresholds, advancing dataset curation workflows

## New Requirements Surfaced

None.

## Requirements Traceability Invalidated or Re-scoped

None.

## Deviations

None. Verification command syntax corrected during execution from --grep to -t (Vitest uses -t/--testNamePattern instead of --grep).

## Known Limitations

Manual smoke test with real MCP client (Claude Code/Cursor/Windsurf) not performed—requires production IDE setup with MCP client configured. Client-side error classification in foxhound_suggest_fix uses heuristic pattern matching rather than ML-based classification—may miss uncommon error patterns or misclassify ambiguous cases. Dataset curation bulk API (createDatasetItemsFromTraces) is async but tool doesn't provide run ID or polling mechanism—users must refresh dataset view to see results.

## Follow-ups

None.

## Files Created/Modified

- `packages/mcp-server/src/index.ts` — Added 10 new MCP tool registrations with Zod schemas, API client wrappers, and markdown formatters for failure analysis, scoring, evaluators, and datasets
- `packages/mcp-server/src/api-client.test.ts` — Added 60 unit tests covering all new tools with success cases, error states, auth failures, missing resources, edge cases, and markdown formatting verification
