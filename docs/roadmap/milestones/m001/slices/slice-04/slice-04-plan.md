# S04: Framework Integration Expansion

**Goal:** Pydantic AI, Mastra, Amazon Bedrock AgentCore, and Google ADK apps can be instrumented with Foxhound via OpenTelemetry bridge modules — one Python SpanProcessor and one TypeScript SpanProcessor — with per-framework configuration examples documented in READMEs.
**Demo:** Pydantic AI, Mastra, Amazon Bedrock AgentCore, Google ADK apps instrumented with one decorator/function call

## Must-Haves

- `FoxhoundSpanProcessor` (Python) implements OTel SpanProcessor interface and maps GenAI semantic conventions to Foxhound spans
- `FoxhoundSpanProcessor` (TypeScript) implements OTel SpanProcessor interface for Mastra and other TS OTel frameworks
- Unit tests verify span lifecycle mapping, semantic convention translation, and attribute extraction for both bridges
- `pyproject.toml` exposes `foxhound-ai[opentelemetry]` optional dependency group
- `package.json` declares `@opentelemetry/api` as peer dependency and exports the integration
- README examples show per-framework wiring for all four target frameworks

## Proof Level

- This slice proves: This slice proves: contract (OTel SpanProcessor interface compliance + semantic convention mapping). Real runtime required: no (OTel spans are mocked in tests — no real framework runtime needed). Human/UAT required: no.

## Integration Closure

Upstream surfaces consumed: `packages/sdk-py/foxhound/tracer.py` (Tracer, ActiveSpan, SpanKind), `packages/sdk-py/foxhound/client.py` (FoxhoundClient.start_trace), `packages/sdk/src/tracer.ts` (Tracer, ActiveSpan), `packages/sdk/src/client.ts` (FoxhoundClient.startTrace). New wiring: OTel SpanProcessor bridge modules in both SDKs, new optional dependency groups, new package.json exports entry. What remains: end-to-end testing with real framework runtimes (out of scope for this slice — would require framework installations and API keys).

## Verification

- Runtime signals: Python bridge logs span mapping decisions at DEBUG level via `logging.getLogger(__name__)`. TypeScript bridge uses console.debug for equivalent. Failure visibility: on_end errors logged with span name and error detail; malformed spans (missing trace_id) logged as warnings and skipped. Redaction constraints: OTel spans may contain prompt content in gen_ai.prompt attribute — bridge truncates to 512 chars matching existing integration pattern.

## Tasks

- [x] **T01: Implement Python OpenTelemetry bridge with tests and packaging** `est:1h30m`
  ## Description

Create the Python OTel bridge module `foxhound/integrations/opentelemetry.py` that implements the OpenTelemetry `SpanProcessor` interface to map GenAI semantic convention spans to Foxhound trace spans. This single module enables instrumentation for Pydantic AI, Amazon Bedrock AgentCore, Google ADK, and any future OTel-instrumented Python framework.

The bridge follows the established integration pattern: tracer instance wraps `foxhound.tracer.Tracer`, factory method `from_client()`, span lifecycle methods, and `flush()`/`flush_sync()` methods.

## Steps

1. Create `packages/sdk-py/foxhound/integrations/opentelemetry.py` with:
   - `FoxhoundSpanProcessor` class implementing the OTel `SpanProcessor` protocol (on_start, on_end, shutdown, force_flush)
   - `from_client(client, agent_id, ...)` classmethod factory (matching existing integration pattern)
   - `on_start(span, parent_context)` — calls `tracer.start_span()` mapping OTel span to Fox span, stores mapping in `_span_map` dict keyed by OTel span context's span_id
   - `on_end(span)` — looks up Fox ActiveSpan from `_span_map`, extracts attributes, calls `span.end()`
   - `_semantic_to_fox_kind(span)` helper — maps `gen_ai.operation.name` attribute values to SpanKind: 'chat'→'llm_call', 'text_completion'→'llm_call', 'embeddings'→'tool_call', else→'workflow'. Also checks span name prefixes for agent/tool patterns.
   - `_extract_attributes(span)` helper — maps OTel GenAI semantic conventions to Fox attributes: `gen_ai.request.model`→`llm.model`, `gen_ai.usage.input_tokens`→`llm.prompt_tokens`, `gen_ai.usage.output_tokens`→`llm.completion_tokens`, `gen_ai.usage.total_tokens`→`llm.total_tokens`, `gen_ai.prompt`→`agent.prompt` (truncated to 512 chars)
   - `shutdown()` and `force_flush()` — call through to tracer.flush_sync()
   - Thread safety via dict-based span storage (matching existing GIL-safe pattern from langgraph.py)
   - Module docstring with usage examples for Pydantic AI, Bedrock AgentCore, and Google ADK
   - `configure_adot_for_foxhound(agent_id, foxhound_endpoint, api_key)` convenience helper for AWS ADOT setup

2. Add `opentelemetry` optional dependency group to `packages/sdk-py/pyproject.toml`:
   ```
   opentelemetry = [
       "opentelemetry-api>=1.20.0",
       "opentelemetry-sdk>=1.20.0",
   ]
   ```

3. Create `packages/sdk-py/tests/test_otel_bridge.py` with unit tests:
   - Test `on_start` + `on_end` produce correct Fox span with kind and attributes
   - Test `_semantic_to_fox_kind` mapping for all GenAI operation types (chat, text_completion, embeddings, tool, agent)
   - Test `_extract_attributes` extracts model, tokens, prompt correctly
   - Test prompt truncation at 512 chars
   - Test parent span ID propagation (nested OTel spans map to Fox parent-child)
   - Test error status propagation (OTel StatusCode.ERROR → Fox 'error' status)
   - Test unknown/missing operation name defaults to 'workflow'
   - Test `shutdown()` calls flush
   - Mock OTel span objects using MagicMock (no real OTel SDK import needed in tests — test the translation logic)

4. Run tests: `cd packages/sdk-py && python -m pytest tests/test_otel_bridge.py -v`

## Must-Haves

- [ ] `FoxhoundSpanProcessor` implements SpanProcessor protocol (on_start, on_end, shutdown, force_flush)
- [ ] `from_client()` factory method matches existing integration pattern
- [ ] GenAI semantic convention mapping covers model, tokens, prompt, operation type
- [ ] SpanKind mapping: chat→llm_call, tool→tool_call, agent→agent_step, default→workflow
- [ ] Thread-safe span storage via dict (GIL-safe pattern)
- [ ] All unit tests pass
- [ ] `opentelemetry` optional dependency group added to pyproject.toml

## Verification

- `cd packages/sdk-py && python -m pytest tests/test_otel_bridge.py -v` — all tests pass
- `python -c "from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor; print('import ok')"` — module imports without error
- `grep -q 'opentelemetry' packages/sdk-py/pyproject.toml` — optional dep group present

## Inputs

- `packages/sdk-py/foxhound/tracer.py` — Tracer, ActiveSpan, SpanKind types used by the bridge
- `packages/sdk-py/foxhound/client.py` — FoxhoundClient.start_trace() factory used by from_client()
- `packages/sdk-py/foxhound/integrations/langgraph.py` — reference integration pattern (factory, span lifecycle, flush, thread safety)
- `packages/sdk-py/foxhound/integrations/openai_agents.py` — reference integration pattern
- `packages/sdk-py/pyproject.toml` — add opentelemetry optional dependency group

## Expected Output

- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — new OTel bridge module (~300 lines)
- `packages/sdk-py/tests/test_otel_bridge.py` — unit tests (~200 lines)
- `packages/sdk-py/pyproject.toml` — updated with opentelemetry optional dependency group
  - Files: `packages/sdk-py/foxhound/integrations/opentelemetry.py`, `packages/sdk-py/tests/test_otel_bridge.py`, `packages/sdk-py/pyproject.toml`
  - Verify: cd packages/sdk-py && python -m pytest tests/test_otel_bridge.py -v

- [x] **T02: Implement TypeScript OpenTelemetry bridge with tests and packaging** `est:1h`
  ## Description

Create the TypeScript OTel bridge module `packages/sdk/src/integrations/opentelemetry.ts` that implements the OpenTelemetry JS `SpanProcessor` interface to map GenAI semantic convention spans to Foxhound trace spans. This enables instrumentation for Mastra and any future OTel-instrumented TypeScript/JavaScript framework.

The bridge follows the established TypeScript integration pattern from `claude-agent.ts`: tracer instance, factory method `fromClient()`, span lifecycle methods, and `flush()`.

## Steps

1. Create `packages/sdk/src/integrations/opentelemetry.ts` with:
   - `FoxhoundSpanProcessor` class implementing the OTel JS `SpanProcessor` interface (onStart, onEnd, shutdown, forceFlush)
   - `fromClient(client, options)` static factory method (matching `FoxhoundClaudeTracer.fromClient` pattern)
   - `onStart(span, parentContext)` — calls `tracer.startSpan()` mapping OTel span to Fox span, stores in `Map<string, ActiveSpan>`
   - `onEnd(span)` — looks up Fox ActiveSpan, extracts GenAI attributes, calls `span.end()`
   - `semanticToFoxKind(span)` — maps gen_ai.operation.name to SpanKind (same logic as Python bridge)
   - `extractAttributes(span)` — maps GenAI semantic conventions to Fox attributes (same mapping as Python)
   - Use `@opentelemetry/api` types only (peer dependency, not bundled) — import types with `import type` where possible
   - JSDoc documentation with Mastra configuration example

2. Update `packages/sdk/package.json`:
   - Add `@opentelemetry/api` as peerDependency (>=1.4.0) with peerDependenciesMeta marking it optional
   - Add exports entry: `"./integrations/opentelemetry"` pointing to `./dist/integrations/opentelemetry.js` and types

3. Create `packages/sdk/src/integrations/opentelemetry.test.ts` with unit tests:
   - Test onStart + onEnd produce correct Fox span with kind and attributes
   - Test semantic convention mapping for all GenAI operation types
   - Test attribute extraction (model, tokens, prompt)
   - Test prompt truncation at 512 chars
   - Test parent span ID propagation
   - Test error status mapping
   - Test shutdown calls flush
   - Mock OTel span objects as plain objects with the required interface shape (no real @opentelemetry/api import needed)
   - Follow the same test helper pattern as `claude-agent.test.ts` (makeTracer, spansByName)

4. Run tests: `cd packages/sdk && pnpm test -- --grep opentelemetry`

## Must-Haves

- [ ] `FoxhoundSpanProcessor` implements SpanProcessor interface (onStart, onEnd, shutdown, forceFlush)
- [ ] `fromClient()` static factory matches existing pattern
- [ ] GenAI semantic convention mapping matches Python bridge behavior
- [ ] `@opentelemetry/api` declared as optional peer dependency (not bundled)
- [ ] Export path added to package.json
- [ ] All unit tests pass

## Verification

- `cd packages/sdk && pnpm test -- --grep opentelemetry` — all tests pass
- `grep -q 'opentelemetry' packages/sdk/package.json` — peer dep and export entry present

## Inputs

- `packages/sdk/src/tracer.ts` — Tracer, ActiveSpan types used by the bridge
- `packages/sdk/src/client.ts` — FoxhoundClient.startTrace() factory
- `packages/sdk/src/integrations/claude-agent.ts` — reference TypeScript integration pattern
- `packages/sdk/src/integrations/claude-agent.test.ts` — reference test pattern
- `packages/sdk/package.json` — add peer dependency and exports entry
- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — Python bridge for consistent behavior

## Expected Output

- `packages/sdk/src/integrations/opentelemetry.ts` — new OTel bridge module (~200 lines)
- `packages/sdk/src/integrations/opentelemetry.test.ts` — unit tests (~150 lines)
- `packages/sdk/package.json` — updated with peer dep and exports
  - Files: `packages/sdk/src/integrations/opentelemetry.ts`, `packages/sdk/src/integrations/opentelemetry.test.ts`, `packages/sdk/package.json`
  - Verify: cd packages/sdk && pnpm test -- --grep opentelemetry

- [x] **T03: Add per-framework configuration examples to Python and TypeScript READMEs** `est:30m`
  ## Description

Add documentation examples to both SDK READMEs showing how to wire the OTel bridge for each of the four target frameworks: Pydantic AI, Amazon Bedrock AgentCore, and Google ADK (Python SDK README), and Mastra (TypeScript SDK README). Each example should be a self-contained code block that users can copy-paste.

## Steps

1. Add to `packages/sdk-py/README.md` an 'OpenTelemetry Bridge' section with:
   - General usage example showing `FoxhoundSpanProcessor.from_client()` + `TracerProvider` setup
   - **Pydantic AI** example: configure TracerProvider with FoxhoundSpanProcessor, create Agent with `instrument=True`
   - **Amazon Bedrock AgentCore** example: show `configure_adot_for_foxhound()` helper usage with env vars
   - **Google ADK** example: show `AdkApp(enable_tracing=True)` with TracerProvider configuration
   - Note on semantic convention coverage gap vs callback-based integrations

2. Add to `packages/sdk/README.md` an 'OpenTelemetry Bridge' section with:
   - General usage example showing `FoxhoundSpanProcessor.fromClient()` + TracerProvider setup
   - **Mastra** example: show Mastra telemetry config with OTLP export pointing to Foxhound, plus SpanProcessor wiring
   - Note that any TypeScript framework emitting OTel GenAI spans works with this bridge

3. Verify documentation renders correctly (no broken markdown).

## Must-Haves

- [ ] Python README has OpenTelemetry Bridge section with Pydantic AI, Bedrock AgentCore, and Google ADK examples
- [ ] TypeScript README has OpenTelemetry Bridge section with Mastra example
- [ ] All code examples use correct import paths matching the actual module structure
- [ ] Coverage gap note included for OTel vs callback-based integrations

## Verification

- `grep -q 'OpenTelemetry Bridge' packages/sdk-py/README.md` — section exists in Python README
- `grep -q 'OpenTelemetry Bridge' packages/sdk/README.md` — section exists in TypeScript README
- `grep -q 'Pydantic AI' packages/sdk-py/README.md && grep -q 'Google ADK' packages/sdk-py/README.md && grep -q 'Bedrock' packages/sdk-py/README.md` — all three Python framework examples present
- `grep -q 'Mastra' packages/sdk/README.md` — Mastra example present in TypeScript README

## Inputs

- `packages/sdk-py/README.md` — existing Python SDK README to extend
- `packages/sdk/README.md` — existing TypeScript SDK README to extend
- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — verify import paths match actual module
- `packages/sdk/src/integrations/opentelemetry.ts` — verify import paths match actual module

## Expected Output

- `packages/sdk-py/README.md` — updated with OpenTelemetry Bridge section and per-framework examples
- `packages/sdk/README.md` — updated with OpenTelemetry Bridge section and Mastra example
  - Files: `packages/sdk-py/README.md`, `packages/sdk/README.md`
  - Verify: grep -q 'OpenTelemetry Bridge' packages/sdk-py/README.md && grep -q 'OpenTelemetry Bridge' packages/sdk/README.md && grep -q 'Pydantic AI' packages/sdk-py/README.md && grep -q 'Mastra' packages/sdk/README.md

## Files Likely Touched

- packages/sdk-py/foxhound/integrations/opentelemetry.py
- packages/sdk-py/tests/test_otel_bridge.py
- packages/sdk-py/pyproject.toml
- packages/sdk/src/integrations/opentelemetry.ts
- packages/sdk/src/integrations/opentelemetry.test.ts
- packages/sdk/package.json
- packages/sdk-py/README.md
- packages/sdk/README.md
