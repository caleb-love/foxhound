# Requirements Traceability Traceability

This file is the explicit capability and coverage contract for the project.

## Active

### R011 — Prompt management hardening
- Status: active
- Validation target: Prompt endpoints enforce route-specific rate limits, prompt API keys support prompts:read/prompts:write scoping, duplicate prompt creation returns 409 on DB unique conflicts, and prompt route coverage includes single-resource, version-listing, and unauthenticated/forbidden cases.

## Validated

### R007 — Untitled
- Status: validated
- Validation: MCP tools foxhound_score_trace and foxhound_get_trace_scores expose score creation and querying from IDE. Users can create manual scores with preview/confirm pattern for any trace or span, supporting both numeric values (0-1) and categorical labels with optional comments. Scores are queryable and displayed in markdown table format. All unit tests pass.

### R008 — Untitled
- Status: validated
- Validation: MCP tools foxhound_list_evaluators, foxhound_run_evaluator, and foxhound_get_evaluator_run expose async LLM-as-a-Judge evaluator workflows from IDE. Users can list configured evaluators, trigger runs for 1-50 traces, and poll run status with contextual emoji formatting (⏳ pending/running, ✅ completed, ❌ failed). Evaluator runs are async and handled by worker service. All unit tests pass.

### R010 — Untitled
- Status: validated
- Validation: MCP tools foxhound_add_trace_to_dataset and foxhound_curate_dataset enable dataset curation from production traces. Users can manually add individual traces (extracting input from root span attributes) or bulk curate using score thresholds (score_name, operator, threshold, optional since_days and limit). Both tools preserve sourceTraceId lineage. Bulk curation calls createDatasetItemsFromTraces API endpoint. All unit tests pass.

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R007 |  | validated | none | none | MCP tools foxhound_score_trace and foxhound_get_trace_scores expose score creation and querying from IDE. Users can create manual scores with preview/confirm pattern for any trace or span, supporting both numeric values (0-1) and categorical labels with optional comments. Scores are queryable and displayed in markdown table format. All unit tests pass. |
| R008 |  | validated | none | none | MCP tools foxhound_list_evaluators, foxhound_run_evaluator, and foxhound_get_evaluator_run expose async LLM-as-a-Judge evaluator workflows from IDE. Users can list configured evaluators, trigger runs for 1-50 traces, and poll run status with contextual emoji formatting (⏳ pending/running, ✅ completed, ❌ failed). Evaluator runs are async and handled by worker service. All unit tests pass. |
| R010 |  | validated | none | none | MCP tools foxhound_add_trace_to_dataset and foxhound_curate_dataset enable dataset curation from production traces. Users can manually add individual traces (extracting input from root span attributes) or bulk curate using score thresholds (score_name, operator, threshold, optional since_days and limit). Both tools preserve sourceTraceId lineage. Bulk curation calls createDatasetItemsFromTraces API endpoint. All unit tests pass. |

## Coverage Summary

- Active requirements: 1 (R011)
- Mapped to slices: 1
- Validated: 3 (R007, R008, R010)
- Unmapped active requirements: 0
