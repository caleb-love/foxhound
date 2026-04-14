# S04: Framework Integration Expansion — UAT

**Milestone:** M001
**Written:** 2026-04-10T07:15:44.050Z

# S04 UAT — Framework Integration Expansion

**Slice:** S04 — Framework Integration Expansion  
**Milestone:** M001  
**Test Date:** 2026-04-10  
**Status:** ✅ Pass

---

## Preconditions

1. Foxhound monorepo is checked out and working directory is at project root
2. Python 3.9+ available; `pytest` installed
3. Node.js 18+ and `pnpm` available
4. Both SDK packages dependencies installed (pnpm install in packages/sdk; pip install in packages/sdk-py)

---

## UAT Test Cases

### Group 1: Python OpenTelemetry Bridge Functionality

#### UC-1.1: Python bridge imports without errors

**Steps:**
1. Open Python interpreter
2. Execute: `from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor`
3. Execute: `from foxhound.integrations.opentelemetry import configure_adot_for_foxhound`

**Expected Outcome:**
- No ImportError or ModuleNotFoundError
- Both symbols available and callable
- Signature inspection shows `FoxhoundSpanProcessor` has methods: `on_start`, `on_end`, `shutdown`, `force_flush`, `from_client`

**Actual Outcome:** ✅ Pass — all imports succeed, all methods present

---

#### UC-1.2: Python bridge maps ChatGPT-style gen_ai spans to llm_call

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_chat_operation_maps_to_llm_call -v`
2. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_text_completion_maps_to_llm_call -v`

**Expected Outcome:**
- Both tests pass
- Span kind correctly identified as `llm_call` (Fox.SpanKind)
- Model, prompt_tokens, completion_tokens, total_tokens extracted and set on Fox span

**Actual Outcome:** ✅ Pass — both tests pass, attributes correctly extracted

---

#### UC-1.3: Python bridge maps embeddings operation to tool_call

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_embeddings_operation_maps_to_tool_call -v`

**Expected Outcome:**
- Test passes
- `gen_ai.operation.name == "embeddings"` → Fox SpanKind `tool_call`

**Actual Outcome:** ✅ Pass

---

#### UC-1.4: Python bridge handles parent-child span nesting

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_three_level_nesting -v`
2. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_parent_span_id_propagated -v`

**Expected Outcome:**
- Child spans correctly reference parent via `parent_id` attribute on Fox span
- 3-level nesting (root > child > grandchild) all propagated correctly
- Root span has `parent_id=None`

**Actual Outcome:** ✅ Pass — nesting propagation correct at all levels

---

#### UC-1.5: Python bridge truncates prompt at 512 chars

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_prompt_truncated_at_512_chars -v`

**Expected Outcome:**
- OTel span with gen_ai.prompt > 512 chars results in Fox span with `agent.prompt` exactly 512 chars
- Span still created and submitted successfully
- No error or warning logged for truncation

**Actual Outcome:** ✅ Pass — truncation at exactly 512 chars

---

#### UC-1.6: Python bridge logs errors without crashing

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_on_start_exception_swallowed -v`
2. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_on_end_exception_swallowed -v`

**Expected Outcome:**
- Exception in on_start is caught and logged at ERROR level
- Exception in on_end is caught and logged at ERROR level
- No exception propagated to caller
- Span processing continues (no crash)

**Actual Outcome:** ✅ Pass — exceptions swallowed and logged

---

#### UC-1.7: Python bridge skip spans with missing traceId

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_on_start_missing_trace_id_logs_warning -v`

**Expected Outcome:**
- OTel span without traceId attribute triggers on_start warning log
- Span is skipped (not added to _span_map)
- No error logged, gracefully degraded
- Log message includes span name and context

**Actual Outcome:** ✅ Pass — warning logged, span skipped gracefully

---

#### UC-1.8: Python bridge `from_client()` factory creates working processor

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_from_client_creates_working_processor -v`

**Expected Outcome:**
- `FoxhoundSpanProcessor.from_client(mock_client, agent_id="test")` returns FoxhoundSpanProcessor instance
- Processor has fully initialized tracer instance
- Processor ready to receive spans

**Actual Outcome:** ✅ Pass — factory creates valid processor

---

#### UC-1.9: Python bridge opentelemetry optional dependency declared

**Steps:**
1. Run: `grep -A 3 '\[project.optional-dependencies\]' packages/sdk-py/pyproject.toml | grep -A 2 'opentelemetry'`
2. Verify entries: `opentelemetry-api>=1.20.0` and `opentelemetry-sdk>=1.20.0`

**Expected Outcome:**
- `pyproject.toml` has `[project.optional-dependencies]` with `opentelemetry = [...]` entry
- Both opentelemetry-api and opentelemetry-sdk >=1.20.0 listed

**Actual Outcome:** ✅ Pass — optional dependency group correctly declared

---

### Group 2: TypeScript OpenTelemetry Bridge Functionality

#### UC-2.1: TypeScript bridge imports without errors

**Steps:**
1. Navigate to `packages/sdk`
2. Verify export: `grep './integrations/opentelemetry' package.json` shows export entry
3. Build: `pnpm build`
4. Verify dist file: `ls -la dist/integrations/opentelemetry.js` (should exist and be > 0 bytes)

**Expected Outcome:**
- Export entry in package.json present and correct
- Build succeeds with no errors
- dist/integrations/opentelemetry.js exists and contains code

**Actual Outcome:** ✅ Pass — export present, builds successfully

---

#### UC-2.2: TypeScript bridge maps semantic conventions correctly

**Steps:**
1. Run test: `cd packages/sdk && pnpm test src/integrations/opentelemetry.test.ts`
2. Look for test output showing:
   - `chat` → `llm_call`
   - `text_completion` → `llm_call`
   - `embeddings` → `tool_call`
   - unknown → `workflow`

**Expected Outcome:**
- All 33 tests in opentelemetry.test.ts pass
- Semantic convention tests specifically verify mapping for all operation types
- Log output shows span kind assignments

**Actual Outcome:** ✅ Pass — 33/33 tests pass, all mappings correct

---

#### UC-2.3: TypeScript bridge extracts OTel attributes to Fox attributes

**Steps:**
1. Run test: `pnpm test src/integrations/opentelemetry.test.ts -- --grep "attribute"` (or similar)
2. Verify attributes extracted: model, tokens (prompt/completion), total, prompt content

**Expected Outcome:**
- OTel gen_ai.request.model → Fox llm.model
- OTel gen_ai.usage.input_tokens → Fox llm.prompt_tokens
- OTel gen_ai.usage.output_tokens → Fox llm.completion_tokens
- OTel gen_ai.usage.total_tokens → Fox llm.total_tokens
- OTel gen_ai.prompt → Fox agent.prompt (512 char truncation)

**Actual Outcome:** ✅ Pass — all attributes extracted correctly

---

#### UC-2.4: TypeScript bridge handles parent span propagation

**Steps:**
1. Run test: `pnpm test src/integrations/opentelemetry.test.ts` and inspect output for parent propagation tests

**Expected Outcome:**
- Child spans reference parent via parentFoxId
- Root span has no parent
- 3-level nesting all propagated correctly

**Actual Outcome:** ✅ Pass — parent propagation correct at all levels

---

#### UC-2.5: TypeScript bridge error status mapping

**Steps:**
1. Run test looking for STATUS_ERROR mapping
2. Verify error status (integer 2) maps to Fox 'error' status

**Expected Outcome:**
- OTel StatusCode.ERROR (value 2) maps to Fox status='error'
- OTel STATUS_UNSET (value 0) maps to Fox status='ok'
- Test passes without exception

**Actual Outcome:** ✅ Pass — error status mapping correct

---

#### UC-2.6: TypeScript bridge @opentelemetry/api peer dependency

**Steps:**
1. Run: `grep '@opentelemetry/api' packages/sdk/package.json | head -5`
2. Verify: peerDependencies has entry
3. Verify: peerDependenciesMeta marks it optional

**Expected Outcome:**
- `@opentelemetry/api` listed as peerDependency (>=1.4.0)
- `peerDependenciesMeta` has optional: true
- Users can install without @opentelemetry/api if they don't use OTel bridge

**Actual Outcome:** ✅ Pass — peer dependency correctly declared optional

---

### Group 3: Documentation & Example Verification

#### UC-3.1: Python README has OpenTelemetry Bridge section

**Steps:**
1. Run: `grep -n 'OpenTelemetry Bridge' packages/sdk-py/README.md`
2. Visually inspect section for:
   - General setup code
   - Pydantic AI example
   - Bedrock AgentCore example
   - Google ADK example
   - Coverage gap note

**Expected Outcome:**
- Section exists with all four framework examples
- Code examples are copy-paste ready (correct imports, config patterns)
- Coverage gap explained (OTel vs callback-based integrations)

**Actual Outcome:** ✅ Pass — all framework examples present and correct

---

#### UC-3.2: Python README examples import from correct module paths

**Steps:**
1. Extract Python examples from README
2. Verify import: `from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor`
3. Verify import: `from foxhound.integrations.opentelemetry import configure_adot_for_foxhound`
4. Check code snippets for correct method names (from_client, etc.)

**Expected Outcome:**
- All imports in README match actual module structure
- Method names are correct (from_client, not from, etc.)
- No typos in class/function names

**Actual Outcome:** ✅ Pass — all imports and paths correct

---

#### UC-3.3: TypeScript README has OpenTelemetry Bridge section

**Steps:**
1. Run: `grep -n 'OpenTelemetry Bridge' packages/sdk/README.md`
2. Visually inspect section for:
   - General setup code
   - Mastra example
   - Coverage note

**Expected Outcome:**
- Section exists with Mastra example
- Code is copy-paste ready
- Coverage note explains OTel bridge works with any OTel-instrumented framework

**Actual Outcome:** ✅ Pass — Mastra example present and correct

---

#### UC-3.4: TypeScript README examples use correct API

**Steps:**
1. Extract TypeScript examples from README
2. Verify: NodeTracerProvider and NodeSDK usage
3. Verify: spanProcessors array pattern
4. Verify: import path for FoxhoundSpanProcessor

**Expected Outcome:**
- TypeScript examples use NodeSDK.spanProcessors (Mastra standard pattern)
- FoxhoundSpanProcessor properly instantiated via fromClient()
- No import errors

**Actual Outcome:** ✅ Pass — all patterns correct

---

### Group 4: Full Test Suite Regression

#### UC-4.1: Python SDK full test suite passes (163 tests)

**Steps:**
1. Navigate to packages/sdk-py
2. Run: `python3 -m pytest tests/ -v --tb=short`
3. Verify: all tests pass, zero failures

**Expected Outcome:**
- 163 tests pass
- No test failures or errors
- No warnings related to opentelemetry bridge
- OTel bridge tests (51) are subset of total

**Actual Outcome:** ✅ Pass — 163/163 tests pass, zero regressions

---

#### UC-4.2: TypeScript SDK full test suite passes (85 tests)

**Steps:**
1. Navigate to packages/sdk
2. Run: `pnpm test`
3. Verify: all tests pass, zero failures

**Expected Outcome:**
- 85 tests pass across 4 test files
- No failures or errors
- OTel bridge tests (33) are subset of total

**Actual Outcome:** ✅ Pass — 85/85 tests pass, zero regressions

---

### Group 5: Edge Cases & Error Handling

#### UC-5.1: Python bridge gracefully handles unknown operation type

**Steps:**
1. Run test: `pytest packages/sdk-py/tests/test_otel_bridge.py::test_unknown_operation_defaults_to_workflow -v`

**Expected Outcome:**
- Unknown gen_ai.operation.name value defaults to SpanKind 'workflow'
- Span is still created and processed
- No error or exception logged

**Actual Outcome:** ✅ Pass — defaults to workflow

---

#### UC-5.2: Python bridge handles null context gracefully

**Steps:**
1. Run tests: `test_on_start_null_context_skipped` and `test_on_end_null_context_is_noop`

**Expected Outcome:**
- on_start with null parent_context skips span processing (logged at WARN)
- on_end with null context is no-op (no error)

**Actual Outcome:** ✅ Pass — null context handled gracefully

---

#### UC-5.3: TypeScript bridge handles missing traceId

**Steps:**
1. Run test looking for "missing traceId" or "no-traceId" in test names
2. Verify span is skipped with console.warn

**Expected Outcome:**
- Span with missing traceId attribute is skipped
- Warning logged to console
- No error or exception

**Actual Outcome:** ✅ Pass — missing traceId handled with warning

---

#### UC-5.4: TypeScript bridge forceFlush calls tracer.flush()

**Steps:**
1. Run test: `pnpm test src/integrations/opentelemetry.test.ts` and verify flush tests
2. Verify both shutdown and forceFlush trigger flush

**Expected Outcome:**
- shutdown() calls tracer.flush() and resolves
- forceFlush() calls tracer.flush() and resolves
- Both comply with OTel spec (active flush, not no-ops)

**Actual Outcome:** ✅ Pass — both flush methods active

---

## Edge Case Coverage Summary

| Edge Case | Python Bridge | TypeScript Bridge | Status |
|-----------|---------------|-------------------|--------|
| Missing traceId | ✅ Warn & skip | ✅ Warn & skip | Pass |
| Unknown operation type | ✅ Default to workflow | ✅ Default to workflow | Pass |
| Null context | ✅ Handle gracefully | ✅ Handle gracefully | Pass |
| Unknown spanId in on_end | ✅ No-op | ✅ No-op | Pass |
| Exception in on_start | ✅ Swallow & log | ✅ Swallow & log | Pass |
| Exception in on_end | ✅ Swallow & log | ✅ Swallow & log | Pass |
| Prompt > 512 chars | ✅ Truncate | ✅ Truncate | Pass |
| Error status mapping | ✅ OTel→Fox | ✅ OTel→Fox | Pass |

---

## Conclusion

**All UAT test cases pass.** S04 successfully delivers:

1. ✅ Python OTel bridge with 51 passing tests, opentelemetry optional dependency
2. ✅ TypeScript OTel bridge with 33 passing tests, @opentelemetry/api optional peer dependency
3. ✅ Per-framework documentation examples for Pydantic AI, Bedrock AgentCore, Google ADK (Python), Mastra (TypeScript)
4. ✅ Zero regressions across 248 tests (Python + TypeScript)
5. ✅ Robust error handling and edge case coverage
6. ✅ Observability via logging/console at DEBUG level
7. ✅ Consistent semantic convention mapping across both SDKs

**Slice S04 ready for downstream integration (S05 Documentation Site).**
