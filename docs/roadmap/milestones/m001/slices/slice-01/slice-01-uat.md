# S01: MCP Server Enhancement — UAT

**Milestone:** M001
**Written:** 2026-04-10T05:26:19.613Z

# UAT: MCP Server Enhancement

## Preconditions

- Foxhound MCP server running locally or in dev environment
- MCP client (Claude Code, Cursor, or Windsurf) configured with Foxhound server
- Valid Foxhound API key in MCP server environment (FOXHOUND_API_KEY)
- Test organization with existing traces, evaluators, and datasets
- At least one failed trace in the system for failure analysis testing

## Test Cases

### TC1: Failure Analysis — Explain Failure

**Steps:**
1. Find a failed trace ID from the test organization (use existing search tools or web UI)
2. Call `foxhound_explain_failure` with the trace ID
3. Verify the response shows:
   - Error summary with count of failed spans
   - Span chain from root to failed span with indentation
   - Error details including span name, kind, duration, and error message
   - All other error spans if multiple failures exist

**Expected Outcome:**
- Tool returns structured markdown with error chain
- Parent span references are correctly resolved
- Error messages extracted from span.events attributes
- No API errors or connection failures

**Edge Cases:**
- Trace with multiple concurrent failures → all error spans listed
- Trace with deeply nested error span → full parent chain shown
- Trace with missing error message attributes → "Unknown error" fallback

### TC2: Failure Analysis — Suggest Fix

**Steps:**
1. Use the same failed trace ID from TC1
2. Call `foxhound_suggest_fix` with the trace ID
3. Verify the response shows:
   - Classified error category (timeout, auth, rate limit, tool error, LLM error, or validation)
   - Category-specific remediation steps
   - Grouped errors if multiple failures with same category

**Expected Outcome:**
- Errors correctly classified based on pattern matching
- Each category has appropriate fix suggestions (e.g., timeout → increase timeout, add retry logic; auth → check API keys; rate limit → implement backoff)
- Multiple errors of same category grouped together

**Edge Cases:**
- Auth error (401/403 in message) → classified as "auth"
- Timeout error (duration > 30s or "timeout" in message) → classified as "timeout"
- LLM error (span.kind === llm_call) → classified as "LLM error"
- Ambiguous error → classified as generic "unknown" or best-guess category

### TC3: Scoring — Create Manual Score (Preview)

**Steps:**
1. Find a successful trace ID
2. Call `foxhound_score_trace` with trace_id, name="quality", value=0.85, comment="High quality response" (without confirm=true)
3. Verify the response shows preview with all parameters
4. Verify no score is actually created (check via foxhound_get_trace_scores)

**Expected Outcome:**
- Tool returns "This will create the following score:" with all details
- Explicitly states "Call again with confirm=true to execute"
- No actual score created in database

### TC4: Scoring — Create Manual Score (Execute)

**Steps:**
1. Call `foxhound_score_trace` with same parameters as TC3 but add confirm=true
2. Verify the response shows success message with score ID
3. Call `foxhound_get_trace_scores` with the trace ID
4. Verify the new score appears in the table

**Expected Outcome:**
- Score created with source="manual"
- Success message includes score ID
- Score visible in subsequent query
- Table shows score name, value, source, and comment

**Edge Cases:**
- Span-level score (with span_id) → score attached to specific span
- Label score instead of value (label="excellent") → label stored instead of numeric value
- Score without comment → comment column shows empty or dash

### TC5: Evaluators — List Evaluators

**Steps:**
1. Call `foxhound_list_evaluators` with no parameters
2. Verify the response shows markdown table with columns: ID, Name, Model, Scoring Type, Enabled
3. Verify enabled status shows ✅ for enabled evaluators, ❌ for disabled

**Expected Outcome:**
- All configured evaluators listed
- Table formatted correctly
- Checkmarks render properly in MCP client

**Edge Cases:**
- No evaluators configured → "No evaluators configured." message
- Evaluator with long name or ID → table columns don't break

### TC6: Evaluators — Trigger Run

**Steps:**
1. Get an evaluator ID from TC5 output
2. Find 2-3 trace IDs from test organization
3. Call `foxhound_run_evaluator` with evaluator_id and trace_ids array
4. Verify the response shows list of queued run IDs
5. Verify the async reminder is included

**Expected Outcome:**
- Tool returns run IDs for each trace
- Response includes "⏳ Evaluator runs are async. Use `foxhound_get_evaluator_run` with a run ID to check status and results."
- No errors for valid trace IDs

**Edge Cases:**
- Single trace ID → one run queued
- 50 trace IDs (max) → all runs queued
- Invalid trace ID → API returns error (not tool error)

### TC7: Evaluators — Check Run Status

**Steps:**
1. Use a run ID from TC6
2. Call `foxhound_get_evaluator_run` with the run_id
3. If status is "pending" or "running", wait 5-10 seconds and retry
4. Verify the response shows status with contextual emoji

**Expected Outcome:**
- Pending/running → ⏳ emoji with "Run is pending/running"
- Completed → ✅ emoji with score ID and tip to use foxhound_get_trace_scores
- Failed → ❌ emoji with error message
- Timestamps shown for creation and completion (if completed)

**Edge Cases:**
- Run completes quickly → completed status with score ID
- Run fails (e.g., model error) → failed status with error message
- Non-existent run ID → 404 error from API

### TC8: Datasets — List Datasets

**Steps:**
1. Call `foxhound_list_datasets` with no parameters
2. Verify the response shows all datasets with item counts and metadata

**Expected Outcome:**
- All datasets listed with IDs, names, item counts
- Table formatted correctly

**Edge Cases:**
- No datasets → "No datasets found." message
- Dataset with 0 items → item count shows 0

### TC9: Datasets — Add Trace (Preview)

**Steps:**
1. Find a dataset ID from TC8 output
2. Find a trace ID not already in the dataset
3. Call `foxhound_add_trace_to_dataset` with dataset_id, trace_id, expected_output="Expected result", metadata='{"tag":"test"}' (without confirm=true)
4. Verify the response shows preview with extracted input from root span attributes

**Expected Outcome:**
- Tool shows "This will add the following item to dataset [name]:"
- Input extracted from root span attributes (span.attributes)
- Expected output and metadata shown
- Source trace ID shown
- Explicitly states "Call again with confirm=true to execute"

### TC10: Datasets — Add Trace (Execute)

**Steps:**
1. Call `foxhound_add_trace_to_dataset` with same parameters as TC9 but add confirm=true
2. Verify the response shows success message
3. Use web UI or API to verify the item was added to the dataset

**Expected Outcome:**
- Item created with correct input, expected_output, metadata, and sourceTraceId
- Success message confirms addition
- Item visible in dataset

**Edge Cases:**
- Trace without expected_output or metadata → optional fields omitted
- Trace with complex nested attributes → input extracted as stringified JSON
- Duplicate trace addition → API may allow or reject (depends on backend logic)

### TC11: Datasets — Bulk Curate

**Steps:**
1. Find a dataset ID from TC8 output
2. Call `foxhound_curate_dataset` with dataset_id, score_name="quality", operator=">=", threshold=0.8, limit=10
3. Verify the response shows success message with filter criteria
4. Wait 5-10 seconds for async processing
5. Check dataset item count (should increase if matching traces exist)

**Expected Outcome:**
- Tool returns "Queued curation job" with filter details
- API accepts the request without error
- Dataset items added for traces matching criteria (quality >= 0.8)

**Edge Cases:**
- No matching traces → no items added, no error
- since_days filter → only traces from last N days considered
- operator variations (>, <=, <, ==, !=) → correct SQL query generated
- Large limit (e.g., 1000) → API handles bulk insert

## Known Limitations

- Manual smoke test requires real MCP client setup (not automated in CI)
- Dataset curation is async but tool doesn't provide polling—users must refresh dataset view
- Error classification uses heuristic patterns—may miss uncommon error types
- No validation that dataset ID, evaluator ID, or trace ID exist before preview (only at execute time)
