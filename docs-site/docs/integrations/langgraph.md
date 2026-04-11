---
title: LangGraph
sidebar_label: LangGraph
---

# LangGraph Integration

Foxhound integrates with LangGraph and LangChain via a callback handler that captures every step — LLM calls, tool invocations, and chain transitions.

## Installation

```bash
pip install foxhound-ai[langgraph]
```

## Usage

```python
from foxhound import FoxhoundClient
from foxhound.integrations.langgraph import FoxCallbackHandler

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()
```

Pass the `FoxCallbackHandler` in the `callbacks` list of the LangGraph/LangChain invocation config. The handler intercepts every framework lifecycle event and sends it to Foxhound as structured spans.

## What gets traced

- LLM calls (model name, prompt, completion, token counts)
- Tool calls (tool name, inputs, outputs)
- Chain start/end with intermediate steps
- Agent actions and observations
- Errors with full stack traces

## Why use the native integration?

The `FoxCallbackHandler` has direct access to raw LangGraph/LangChain event payloads, capturing per-turn tool call arguments and intermediate reasoning steps that the [OTel bridge](./opentelemetry-bridge) cannot access from generic GenAI spans.

## Related

- [Python SDK Reference →](../sdk/python)
- [OpenTelemetry bridge →](./opentelemetry-bridge)
