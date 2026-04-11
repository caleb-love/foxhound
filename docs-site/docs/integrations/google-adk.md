---
title: Google ADK
sidebar_label: Google ADK
---

# Google ADK Integration

Foxhound integrates with Google Agent Development Kit (ADK) via the OpenTelemetry bridge. Google ADK emits OTel spans when tracing is enabled on `AdkApp`.

## Installation

```bash
pip install foxhound-ai[opentelemetry] google-adk
```

## Usage

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry import trace

from foxhound import FoxhoundClient
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor
from google.adk.app import AdkApp

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
processor = FoxhoundSpanProcessor.from_client(fox, agent_id="google-adk-agent")

provider = TracerProvider()
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Google ADK emits OTel spans when tracing is enabled
app = AdkApp(agent=my_agent, enable_tracing=True)
await app.run_async(user_id="user-1", session_id="session-1", input_text="Hello")
await processor.flush()
```

Pass `enable_tracing=True` to `AdkApp` — this activates OTel span emission from the ADK runtime, which Foxhound then captures.

## What gets traced

- Agent run lifecycle (start, step, complete)
- LLM calls (model, prompt, completion, token counts)
- Tool invocations
- Multi-turn conversation turns

## Related

- [Python SDK Reference →](../sdk/python)
- [OpenTelemetry bridge overview →](./opentelemetry-bridge)
