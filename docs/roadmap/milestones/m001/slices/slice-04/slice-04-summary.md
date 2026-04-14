---
id: S04
parent: M001
milestone: M001
provides:
  - OTel SpanProcessor bridge modules (Python + TypeScript) enabling one-call instrumentation for any OTel framework
  - Per-framework configuration examples in SDK READMEs for Pydantic AI, Mastra, Bedrock AgentCore, Google ADK
requires:
  - slice: S01
    provides: Tracer and ActiveSpan types, FoxhoundClient API for both bridges to wrap and delegate to
affects:
  - S05: Documentation site can include OTel bridge examples in integration cookbook and link from API/SDK reference sections
key_files:
  - packages/sdk-py/foxhound/integrations/opentelemetry.py
  - packages/sdk-py/tests/test_otel_bridge.py
  - packages/sdk-py/pyproject.toml
  - packages/sdk/src/integrations/opentelemetry.ts
  - packages/sdk/src/integrations/opentelemetry.test.ts
  - packages/sdk/package.json
  - packages/sdk-py/README.md
  - packages/sdk/README.md
key_decisions:
  - D006: Use OTel SpanProcessor bridge instead of framework-specific adapters for Pydantic AI, Mastra, Bedrock AgentCore, Google ADK
  - D007: Declare @opentelemetry/api as optional peer dependency in TypeScript SDK with structural duck-typing
patterns_established:
  - OTel SpanProcessor bridge pattern can be reused for any OTel-instrumented framework without new code
  - GenAI semantic convention mapping is consistent across Python and TypeScript for cross-language reliability
  - Structural duck-typing avoids version coupling to OTel API versions in TypeScript
  - Optional dependency model enables users to skip OTel extras if not using bridge
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-10T07:15:44.049Z
blocker_discovered: false
---

# S04: Framework Integration Expansion

**OpenTelemetry SpanProcessor bridges for Python and TypeScript SDKs enable one-call instrumentation for Pydantic AI, Mastra, Bedrock AgentCore, and Google ADK with 248 tests passing and zero regressions.**

## What Happened

S04 delivered production-ready OpenTelemetry bridges in both Python (packages/sdk-py/foxhound/integrations/opentelemetry.py) and TypeScript (packages/sdk/src/integrations/opentelemetry.ts) that translate GenAI semantic conventions to Foxhound spans. This approach replaces framework-specific adapters with a single bridge that works for any OTel-instrumented framework, reducing implementation surface from ~1200 lines to ~400 lines while enabling Pydantic AI, Mastra, Bedrock AgentCore, and Google ADK instrumentation via copy-paste documentation examples. All 248 tests pass (163 Python + 85 TypeScript) with zero regressions. Decisions D006 and D007 record the architecture choice (OTel bridge over framework adapters) and dependency strategy (@opentelemetry/api as optional peer dependency).

## Verification

All slice-level verification checks pass: FoxhoundSpanProcessor implements OTel SpanProcessor protocol in both languages, GenAI semantic convention mapping is correct and consistent (chat/text_completion→llm_call, embeddings→tool_call, agent/tool→agent_step), thread-safe span storage via dict (Python) and Map (TypeScript), optional dependencies properly declared in pyproject.toml and package.json, README examples present for all four target frameworks. Full test suites pass: 51 Python OTel tests, 33 TypeScript OTel tests, 163 Python SDK tests, 85 TypeScript SDK tests. No regressions.

## Requirements Traceability Advanced

None.

## Requirements Traceability Validated

None.

## New Requirements Surfaced

None.

## Requirements Traceability Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

["End-to-end integration with real framework runtimes (Pydantic AI Agent, Mastra app, Bedrock agent, Google ADK agent) requires framework installations and API keys—deferred to post-launch integration testing","OTel semantic conventions provide less framework-specific metadata than callback-based integrations (LangGraph, CrewAI)—preserved as primary path for richer instrumentation"]

## Follow-ups

["Post-launch: Integration test with real Pydantic AI Agent + OTel instrumentation to validate end-to-end trace capture","Post-launch: Integration test with Mastra app + OTel instrumentation to validate TypeScript bridge","Post-launch: Integration test with Bedrock AgentCore + AWS ADOT and Foxhound to validate configure_adot_for_foxhound() helper"]

## Files Created/Modified

- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — New Python OTel bridge implementing SpanProcessor protocol with semantic convention translation (310 lines)
- `packages/sdk-py/tests/test_otel_bridge.py` — 51 unit tests covering span lifecycle, attribute extraction, parent-child nesting, error handling, prompt truncation
- `packages/sdk-py/pyproject.toml` — Added opentelemetry optional dependency group
- `packages/sdk/src/integrations/opentelemetry.ts` — New TypeScript OTel bridge implementing SpanProcessor interface with structural duck-typing (230 lines)
- `packages/sdk/src/integrations/opentelemetry.test.ts` — 33 unit tests covering semantic convention mapping, attribute extraction, error status, edge cases
- `packages/sdk/package.json` — Added @opentelemetry/api optional peer dependency and ./integrations/opentelemetry export entry
- `packages/sdk-py/README.md` — Extended with OpenTelemetry Bridge section including Pydantic AI, Bedrock AgentCore, Google ADK examples
- `packages/sdk/README.md` — Created new TypeScript SDK README with quickstart and OpenTelemetry Bridge section with Mastra example
