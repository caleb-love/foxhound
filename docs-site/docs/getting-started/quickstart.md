---
title: Quickstart
sidebar_label: Quickstart
---

# Quickstart

Send your first trace to Foxhound in under five minutes.

## Python

### Manual tracing

```python
from foxhound import FoxhoundClient

fox = FoxhoundClient(
    api_key="fox_...",
    endpoint="https://your-foxhound-instance.com",
)

async with fox.trace(agent_id="my-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "user question")
    span.end()
```

### LangGraph (quickstart)

```python
from foxhound import FoxhoundClient
from foxhound.integrations.langgraph import FoxCallbackHandler

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()
```

## TypeScript / Node.js

```typescript
import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: "fox_...",
  endpoint: "https://your-foxhound-instance.com",
});

const tracer = fox.startTrace({ agentId: "my-agent" });

const span = tracer.startSpan({ name: "tool:search", kind: "tool_call" });
span.setAttribute("query", "user question");
span.end();

await tracer.flush();
```

## View Traces

After running your agent, open the local viewer:

```bash
# Python
foxhound ui

# TypeScript / Node.js
npx foxhound ui
```

Or navigate to your Foxhound instance dashboard to explore the full span tree.

## Next Steps

- [Your First Trace →](./first-trace) — explore the Foxhound UI
- [Python SDK Reference →](../sdk/python) — all tracing APIs and framework integrations
- [TypeScript SDK Reference →](../sdk/typescript) — OTel bridge and native SDK
