---
title: OpenTelemetry Bridge
sidebar_label: OpenTelemetry Bridge
---

# OpenTelemetry Bridge

The Foxhound OTel bridge lets any framework that emits [OpenTelemetry GenAI semantic convention](https://opentelemetry.io/docs/specs/semconv/gen-ai/) spans send traces to Foxhound — **one import, zero framework code changes**.

## How it works

Foxhound provides a `FoxhoundSpanProcessor` that implements the OTel `SpanProcessor` interface. You register it with your OTel `TracerProvider` at startup; from that point forward, every span your framework emits is automatically forwarded to Foxhound.

```
Framework (Mastra, Pydantic AI, Google ADK, ...)
        │  emits OTel GenAI spans
        ▼
TracerProvider
        │  routes to all registered processors
        ▼
FoxhoundSpanProcessor
        │  batches + forwards
        ▼
Foxhound API
```

## Python

```bash
pip install foxhound-ai[opentelemetry]
```

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry import trace

from foxhound import FoxhoundClient
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
processor = FoxhoundSpanProcessor.from_client(fox, agent_id="my-agent")

provider = TracerProvider()
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

await processor.flush()
```

## TypeScript

```bash
npm install @foxhound-ai/sdk @opentelemetry/api @opentelemetry/sdk-node
```

```typescript
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: "fox_...",
  endpoint: "https://your-foxhound-instance.com",
});
const processor = FoxhoundSpanProcessor.fromClient(fox, { agentId: "my-agent" });

const provider = new NodeTracerProvider();
provider.addSpanProcessor(processor);
trace.setGlobalTracerProvider(provider);

await processor.forceFlush();
```

## Supported frameworks

| Framework | Language | Notes |
|-----------|----------|-------|
| Mastra | TypeScript | Set `telemetry.enabled: true` |
| Vercel AI SDK | TypeScript | Emits OTel GenAI spans natively |
| LlamaIndex.TS | TypeScript | Emits OTel GenAI spans natively |
| Pydantic AI | Python | Set `instrument=True` on Agent |
| Google ADK | Python | Set `enable_tracing=True` on AdkApp |
| Amazon Bedrock AgentCore | Python | Use `configure_adot_for_foxhound()` helper |

## Coverage note

The OTel bridge captures data encoded in OTel GenAI semantic convention attributes. Framework-specific metadata not yet standardised in those conventions — such as per-turn tool call arguments from CrewAI or LangGraph — is only available via the native callback-based integrations:

- [LangGraph integration →](./langgraph) — `FoxCallbackHandler`
- [CrewAI integration →](./crewai) — `FoxCrewTracer`

## Related

- [Python SDK Reference →](../sdk/python)
- [TypeScript SDK Reference →](../sdk/typescript)
