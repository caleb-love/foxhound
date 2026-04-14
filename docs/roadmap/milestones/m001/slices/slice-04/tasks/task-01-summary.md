---
id: T01
parent: S04
milestone: M001
key_files:
  - packages/sdk-py/foxhound/integrations/opentelemetry.py
  - packages/sdk-py/tests/test_otel_bridge.py
  - packages/sdk-py/pyproject.toml
key_decisions:
  - Used MagicMock for all OTel span simulation so opentelemetry-sdk is not a test dependency
  - _otel_status() compares StatusCode by .name string to avoid hard OTel SDK import in tests
  - shutdown() and force_flush() actively call flush_sync() per OTel spec (not no-ops)
  - Keyed _span_map by OTel integer span_id (not string UUID) matching OTel SDK data model
  - Prompt truncation at 512 chars matching established integration pattern
duration: 
verification_result: passed
completed_at: 2026-04-10T06:58:53.892Z
blocker_discovered: false
---

# T01: Implemented FoxhoundSpanProcessor OTel bridge with 51 passing tests and opentelemetry optional dep group, enabling Pydantic AI, Bedrock AgentCore, and Google ADK instrumentation via a single SpanProcessor

**Implemented FoxhoundSpanProcessor OTel bridge with 51 passing tests and opentelemetry optional dep group, enabling Pydantic AI, Bedrock AgentCore, and Google ADK instrumentation via a single SpanProcessor**

## What Happened

Created packages/sdk-py/foxhound/integrations/opentelemetry.py (~310 lines) implementing the OpenTelemetry SpanProcessor protocol. The bridge follows the established integration pattern from langgraph.py and openai_agents.py: from_client() factory, GIL-safe _span_map dict (keyed by OTel integer span_id), full lifecycle methods (on_start, on_end, shutdown, force_flush), and flush()/flush_sync() delegation. _semantic_to_fox_kind() maps gen_ai.operation.name to Fox SpanKind with name-prefix heuristics as fallback. _extract_attributes() maps the five GenAI semantic convention fields to Fox keys with 512-char prompt truncation. Added configure_adot_for_foxhound() convenience helper for AWS Bedrock AgentCore. Added opentelemetry optional dependency group to pyproject.toml. Wrote 51 unit tests using MagicMock (no real OTel SDK required) covering all mapping paths, parent-child nesting, error propagation, exception swallowing, and observability logging.

## Verification

Ran python3 -m pytest tests/test_otel_bridge.py -v — 51/51 pass in 80ms. Import check passes. grep for opentelemetry dep group in pyproject.toml passes. Full non-framework test suite (89 tests) passes with zero regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd packages/sdk-py && python3 -m pytest tests/test_otel_bridge.py -v` | 0 | ✅ pass | 80ms |
| 2 | `python3 -c "from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor; print('import ok')"` | 0 | ✅ pass | 90ms |
| 3 | `grep -q 'opentelemetry' packages/sdk-py/pyproject.toml && echo 'dep group present'` | 0 | ✅ pass | 5ms |
| 4 | `cd packages/sdk-py && python3 -m pytest tests/ -q (non-framework)` | 0 | ✅ pass | 100ms |

## Deviations

shutdown() and force_flush() actively call flush_sync() rather than being no-ops. The OTel spec requires force_flush to attempt flushing; the openai_agents no-op pattern is specific to that SDK's lifecycle.

## Known Issues

None.

## Files Created/Modified

- `packages/sdk-py/foxhound/integrations/opentelemetry.py`
- `packages/sdk-py/tests/test_otel_bridge.py`
- `packages/sdk-py/pyproject.toml`
