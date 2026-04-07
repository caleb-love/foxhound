# fox-sdk

Compliance-grade observability for AI agent fleets — trace, replay, and audit every agent decision.

## Installation

```bash
pip install fox-sdk                   # core only
pip install fox-sdk[langgraph]        # + LangGraph / LangChain support
pip install fox-sdk[crewai]           # + CrewAI support
```

## Quickstart

### LangGraph

```python
from fox_sdk import FoxClient
from fox_sdk.integrations.langgraph import FoxCallbackHandler

fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")

handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()
```

### CrewAI

```python
from crewai import Agent, Crew, Task
from fox_sdk import FoxClient
from fox_sdk.integrations.crewai import FoxCrewTracer

fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")
tracer = FoxCrewTracer.from_client(fox, agent_id="my-crew")

researcher = Agent(role="Researcher", goal="Research topics", backstory="...")
task = Task(description="Research AI safety", agent=researcher)

crew = Crew(
    agents=[researcher],
    tasks=[task],
    step_callback=tracer.on_step,
    task_callback=tracer.on_task,
)

# Synchronous
result = tracer.kickoff(crew, inputs={"topic": "AI safety"})
tracer.flush_sync()

# Async
result = await tracer.kickoff_async(crew, inputs={"topic": "AI safety"})
await tracer.flush()
```

### Manual tracing

```python
from fox_sdk import FoxClient

fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")

async with fox.trace(agent_id="my-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "user question")
    span.end()
```

## Viewer

Start the local OSS trace viewer:

```bash
foxhound serve
```

## License

MIT
