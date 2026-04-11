---
title: Pydantic AI
sidebar_label: Pydantic AI
---

# Pydantic AI Integration

Foxhound integrates with Pydantic AI via the OpenTelemetry span processor bridge. Pydantic AI emits OTel GenAI spans when `instrument=True` is set on the agent.

## Installation

```bash
pip install foxhound-ai[opentelemetry] pydantic-ai
```

## Usage

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry import trace

from foxhound import FoxhoundClient
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor
from pydantic_ai import Agent

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
processor = FoxhoundSpanProcessor.from_client(fox, agent_id="my-pydantic-agent")

provider = TracerProvider()
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Pydantic AI emits OTel GenAI spans automatically with instrument=True
agent = Agent("openai:gpt-4o", instrument=True)
result = await agent.run("Summarise the latest AI safety research.")
await processor.flush()
```

## What gets traced

- LLM calls (model, prompt, completion, token counts)
- Tool calls with inputs and outputs
- Agent run lifecycle

## Related

- [Python SDK Reference →](../sdk/python)
- [OpenTelemetry bridge overview →](./opentelemetry-bridge)
