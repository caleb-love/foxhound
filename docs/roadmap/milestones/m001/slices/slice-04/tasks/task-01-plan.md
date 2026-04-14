---
estimated_steps: 55
estimated_files: 3
skills_used: []
---

# T01: Implement Python OpenTelemetry bridge with tests and packaging

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

## Inputs

- `packages/sdk-py/foxhound/tracer.py`
- `packages/sdk-py/foxhound/client.py`
- `packages/sdk-py/foxhound/integrations/langgraph.py`
- `packages/sdk-py/foxhound/integrations/openai_agents.py`
- `packages/sdk-py/pyproject.toml`

## Expected Output

- `packages/sdk-py/foxhound/integrations/opentelemetry.py`
- `packages/sdk-py/tests/test_otel_bridge.py`
- `packages/sdk-py/pyproject.toml`

## Verification

cd packages/sdk-py && python -m pytest tests/test_otel_bridge.py -v
