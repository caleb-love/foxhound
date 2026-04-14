# S04 Research — Framework Integration Expansion

## Summary

All four target frameworks (Pydantic AI, Mastra, Amazon Bedrock AgentCore, Google ADK) use OpenTelemetry as their instrumentation mechanism. This significantly simplifies integration work compared to frameworks with custom callback systems.

**Pydantic AI** (Python) uses OpenTelemetry directly and exposes a `RunContext.tracer` that implementations can provide. Users enable instrumentation via `logfire.instrument_pydantic_ai()` or by passing `instrument=True` to Agent constructor. The framework has lifecycle hooks via capabilities, not callbacks.

**Mastra** (TypeScript/JavaScript) has built-in OpenTelemetry support with automatic instrumentation when `telemetry.enabled: true` in config. Emits standard OTel spans for agent operations, LLM calls, tools, integrations, workflows, and database ops. Their legacy telemetry system is deprecated; new AI Tracing system is the current path.

**Amazon Bedrock AgentCore** (Python) uses AWS Distro for OpenTelemetry (ADOT) for instrumentation. Runtime-hosted agents get automatic instrumentation; non-runtime agents require `aws-opentelemetry-distro` + framework-specific auto-instrumentors (e.g., `opentelemetry-instrumentation-langchain`). AgentCore provides a managed observability experience via CloudWatch GenAI Observability dashboard.

**Google ADK** (Python/TypeScript/Go/Java) has first-class OpenTelemetry support built in. Python: `AdkApp(enable_tracing=True)` or use `google.adk.telemetry` modules. TypeScript: `getGcpExporters()` + `maybeSetOtelProviders()`. ADK emits standard semantic conventions for generative AI. Integrates with Google Cloud Trace, Langfuse, AgentOps, and any OTel-compatible backend.

## Recommendation

**Build OpenTelemetry bridge integrations, not framework-specific adapters.**

Instead of four separate integration modules (one per framework), build a single `packages/sdk-py/foxhound/integrations/opentelemetry.py` module that acts as a bridge between OTel semantic conventions and Foxhound's trace model. Then document per-framework configuration in README examples.

This approach:
- Reduces implementation surface from ~1200 lines (4 × 300-line integrations) to ~400 lines (1 bridge + 4 config examples)
- Works immediately with any future OTel-instrumented framework (CrewAI, LangGraph, etc.)
- Aligns with the industry standard (OpenTelemetry semantic conventions for GenAI)
- Eliminates version coupling risk (framework API changes don't break our integration)

**For frameworks already integrated via callbacks** (LangGraph, CrewAI, Autogen, OpenAI Agents, Claude Agent SDK), preserve the existing integrations — they provide richer lifecycle hooks and framework-specific metadata that OTel's generic span model cannot capture.

## Implementation Landscape

### Existing Integration Modules (Python SDK)

```
packages/sdk-py/foxhound/integrations/
├── __init__.py          (empty)
├── langgraph.py         (FoxCallbackHandler extends BaseCallbackHandler — 379 lines)
├── crewai.py            (FoxCrewTracer with step/task callbacks — 414 lines)
├── autogen.py           (message introspection pattern — 662 lines)
├── claude_agent.py      (message observer pattern — 379 lines)
└── openai_agents.py     (TracingProcessor hook — 379 lines)
```

All integrations follow the same structure:
1. Tracer instance wraps `foxhound.tracer.Tracer`
2. Factory method `from_client(client, agent_id, ...)`
3. Span lifecycle methods map framework events to Fox spans
4. `flush()` / `flush_sync()` methods submit trace
5. Thread-safe span storage via dicts (GIL safety)

Each integration is 300-700 lines. Pattern is well-established and consistent.

### Existing Integration Modules (TypeScript SDK)

```
packages/sdk/src/integrations/
└── claude-agent.ts      (FoxhoundClaudeTracer — 180 lines)
```

Single TypeScript integration exists. Pattern is simpler than Python (no callback inheritance, just observer methods). Similar structure: tracer instance, span lifecycle, flush.

### Target Framework Observability Patterns

| Framework | Language | Instrumentation Mechanism | Integration Point |
|-----------|----------|---------------------------|-------------------|
| Pydantic AI | Python | OpenTelemetry (RunContext.tracer) | Provide custom OTel tracer via capability |
| Mastra | TypeScript/JS | OpenTelemetry (automatic) | Configure OTel exporter to Foxhound endpoint |
| Amazon Bedrock AgentCore | Python | AWS ADOT (OpenTelemetry) | Configure ADOT exporter or use framework instrumentor |
| Google ADK | Python/TS/Go/Java | OpenTelemetry (built-in) | Enable tracing flag + configure exporter |

### OpenTelemetry Bridge Architecture

```
foxhound.integrations.opentelemetry
├── FoxhoundSpanProcessor (OTel SpanProcessor implementation)
│   ├── on_start(span, parent_context)  → startSpan()
│   ├── on_end(span)                     → endSpan()
│   └── shutdown()                       → flush()
│
├── semantic_to_fox_kind(span) → SpanKind
│   ├── gen_ai.operation.name == "chat" → "llm_call"
│   ├── gen_ai.operation.name == "tool" → "tool_call"
│   ├── gen_ai.operation.name == "agent" → "agent_step"
│   └── else → "workflow"
│
└── extract_attributes(span) → dict
    ├── gen_ai.request.model → llm.model
    ├── gen_ai.usage.input_tokens → llm.input_tokens
    ├── gen_ai.usage.output_tokens → llm.output_tokens
    └── gen_ai.prompt → agent.prompt (truncated)
```

The bridge maps OTel semantic conventions to Foxhound span attributes. Works for any framework that emits GenAI semantic conventions.

### Integration Verification Pattern

All existing integrations include:
- Example usage block in module docstring
- Sync + async variants
- Installation requirements (`pip install foxhound-ai[framework]`)
- Thread/async safety notes

New OTel bridge should follow same pattern:
```python
"""
OpenTelemetry bridge integration for the Fox observability SDK.

Works with any framework that emits OpenTelemetry spans following
GenAI semantic conventions: Pydantic AI, Mastra, Amazon Bedrock AgentCore,
Google ADK, LangGraph, CrewAI, and others.

Usage::

    from foxhound import FoxhoundClient
    from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://...")
    processor = FoxhoundSpanProcessor.from_client(fox, agent_id="my-agent")

    # Configure your framework's OTel provider to use this processor
    from opentelemetry.sdk.trace import TracerProvider
    provider = TracerProvider()
    provider.add_span_processor(processor)
    
    # Framework-specific configuration:
    # Pydantic AI: Pass tracer via RunContext
    # Mastra: Configure OTLP exporter endpoint
    # AgentCore: Set OTEL_EXPORTER_OTLP_ENDPOINT env var
    # Google ADK: Use AdkApp(enable_tracing=True)

Requires: ``pip install foxhound-ai[opentelemetry]``
"""
```

### Per-Framework Configuration Examples

Each framework needs a README example showing how to wire the OTel bridge. Examples:

**Pydantic AI:**
```python
from pydantic_ai import Agent
from opentelemetry.sdk.trace import TracerProvider
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

fox = FoxhoundClient(...)
processor = FoxhoundSpanProcessor.from_client(fox, agent_id="pydantic-agent")
provider = TracerProvider()
provider.add_span_processor(processor)

agent = Agent("openai:gpt-4", instrument=True)
# RunContext will use the global OTel provider
```

**Mastra:**
```typescript
import { Mastra } from '@mastra/core';
import { FoxhoundSpanProcessor } from '@foxhound-ai/sdk/integrations/opentelemetry';

const fox = new FoxhoundClient({ apiKey: '...' });
const processor = FoxhoundSpanProcessor.fromClient(fox, { agentId: 'mastra-agent' });

const mastra = new Mastra({
  telemetry: {
    enabled: true,
    export: {
      type: 'otlp',
      endpoint: 'http://localhost:4318',  // Foxhound OTLP receiver
    },
  },
});
```

**Amazon Bedrock AgentCore:**
```python
import os
from foxhound.integrations.opentelemetry import configure_adot_for_foxhound

configure_adot_for_foxhound(
    agent_id="bedrock-agent",
    foxhound_endpoint="https://...",
    api_key="fox_...",
)

# ADOT auto-instrumentation will now send spans to Foxhound
os.environ['OTEL_PYTHON_DISTRO'] = 'aws_distro'
```

**Google ADK:**
```python
from google.adk.apps import AdkApp
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

fox = FoxhoundClient(...)
processor = FoxhoundSpanProcessor.from_client(fox, agent_id="adk-agent")

adk_app = AdkApp(
    agent=root_agent,
    enable_tracing=True,  # ADK emits OTel spans
)

# Configure OTel provider to use Foxhound processor
from opentelemetry.sdk.trace import TracerProvider
provider = TracerProvider()
provider.add_span_processor(processor)
```

### Constraints

**Semantic convention coverage gap:** OpenTelemetry GenAI semantic conventions (as of v1.33) do not capture all framework-specific metadata that our callback-based integrations currently collect. Examples:
- LangGraph: `run_id` → `parent_run_id` mapping for complex chains
- CrewAI: Step-level task metadata, agent identity from TaskOutput
- Autogen: Message role transitions, GroupChat speaker selection

The OTel bridge will capture standard attributes (model, tokens, duration, status) but will miss framework-specific details unless frameworks add them as custom span attributes.

**Mitigation:** Document which metadata is preserved in OTel-based integrations vs callback-based integrations. For users who need richer metadata, recommend continuing to use callback-based integrations where available.

**ADOT complexity:** AWS ADOT requires specific environment variables and may conflict with other OTel configurations. AgentCore documentation shows 8+ required env vars for non-runtime agents. Helper functions needed to simplify this.

**TypeScript OTel SDK weight:** `@opentelemetry/sdk-node` and instrumentations add ~10MB to bundle size. May require peer dependency instead of direct dependency to avoid bloating the SDK for users who don't need OTel bridge.

### Risk: Maintenance Overhead for Dual Integration Paths

**Risk:** Maintaining both callback-based integrations (LangGraph, CrewAI, etc.) and OTel bridge creates two parallel maintenance surfaces. If Foxhound's span model changes, both need updates.

**Mitigation:** All integrations use the same `foxhound.tracer.Tracer` core. Span model changes propagate automatically. The integration layer is stateless translation — no business logic. Regression tests run against both integration paths.

**Decision point:** Should we deprecate callback-based integrations in favor of OTel-only? **No** — callback-based integrations capture richer metadata and are already deployed to users. OTel bridge is additive, not a replacement.

### Files Likely Modified

- `packages/sdk-py/foxhound/integrations/opentelemetry.py` (new)
- `packages/sdk-py/pyproject.toml` (add `opentelemetry` optional dependency)
- `packages/sdk-py/README.md` (add per-framework configuration examples)
- `packages/sdk/src/integrations/opentelemetry.ts` (new, TypeScript bridge for Mastra)
- `packages/sdk/package.json` (add `@opentelemetry/api` peer dependency)
- `packages/sdk/README.md` (add Mastra configuration example)

### Test Strategy

**Unit tests:**
- Mock OTel span lifecycle (on_start, on_end)
- Verify semantic convention mapping (gen_ai.operation.name → SpanKind)
- Verify attribute extraction (model, tokens, etc.)

**Integration tests:**
- Run real Pydantic AI agent with OTel bridge → verify trace structure
- Run real Google ADK agent with OTel bridge → verify span hierarchy
- Compare OTel-based trace vs callback-based trace for overlapping frameworks (LangGraph supports both)

**No E2E needed** — frameworks already test their OTel emission. We only test the bridge translation layer.

## Sources

- <cite index="2-1,2-19">Pydantic AI has built-in support for Logfire instrumentation, which is OTel-based</cite>
- <cite index="10-7,10-25">Pydantic AI uses OpenTelemetry and can send data to any OTel backend</cite>
- <cite index="11-6,11-7">Mastra supports OpenTelemetry Protocol (OTLP) and automatically traces all core primitives including agent operations, LLM interactions, tool executions, integration calls, workflow runs, and database operations</cite>
- <cite index="16-6,16-8,16-9">Mastra deprecated legacy OTEL telemetry in favor of new AI Tracing system with specialized instrumentation for AI operations, flexible export architecture, and advanced processing pipeline</cite>
- <cite index="21-1,21-10,21-15">Amazon Bedrock AgentCore requires ADOT SDK and boto3 dependencies, uses auto-instrumentation approach via opentelemetry-instrument command</cite>
- <cite index="25-1">AgentCore emits telemetry in standardized OTEL-compatible format</cite>
- <cite index="31-1,31-7,31-18">Google ADK can be instrumented with OpenTelemetry packages including opentelemetry-instrumentation-google-genai, opentelemetry-exporter-gcp-logging, opentelemetry-exporter-gcp-monitoring, and opentelemetry-exporter-otlp-proto-grpc</cite>
- <cite index="37-1,37-6">Google ADK Cloud Trace is built on OpenTelemetry and ADK leverages OpenTelemetry-compatible instrumentation</cite>
