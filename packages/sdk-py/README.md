# foxhound-ai

Compliance-grade observability for AI agent fleets — trace, replay, and audit every agent decision.

## Installation

```bash
pip install foxhound-ai                   # core only
pip install foxhound-ai[langgraph]        # + LangGraph / LangChain support
pip install foxhound-ai[crewai]           # + CrewAI support
```

## Quickstart

### LangGraph

```python
from foxhound import FoxhoundClient
from foxhound.integrations.langgraph import FoxCallbackHandler

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()
```

### CrewAI

```python
from crewai import Agent, Crew, Task
from foxhound import FoxhoundClient
from foxhound.integrations.crewai import FoxCrewTracer

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
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
from foxhound import FoxhoundClient

fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

async with fox.trace(agent_id="my-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "user question")
    span.end()
```

## Viewer

Start the local OSS trace viewer:

```bash
foxhound ui
```

## License

MIT
