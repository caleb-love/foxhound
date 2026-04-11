---
title: CrewAI
sidebar_label: CrewAI
---

# CrewAI Integration

Foxhound integrates with CrewAI via `FoxCrewTracer`, which hooks into step and task callbacks to capture agent activity.

## Installation

```bash
pip install foxhound-ai[crewai]
```

## Usage

### Synchronous

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

result = tracer.kickoff(crew, inputs={"topic": "AI safety"})
tracer.flush_sync()
```

### Async

```python
result = await tracer.kickoff_async(crew, inputs={"topic": "AI safety"})
await tracer.flush()
```

## What gets traced

- Per-agent steps with tool calls and outputs
- Task lifecycle (start, complete, fail)
- Inter-agent handoffs
- LLM calls from each agent
- Errors and retries

## Why use the native integration?

`FoxCrewTracer` has direct access to raw CrewAI event payloads, including per-turn tool call arguments that are not available through the generic [OTel bridge](./opentelemetry-bridge).

## Related

- [Python SDK Reference →](../sdk/python)
- [OpenTelemetry bridge →](./opentelemetry-bridge)
