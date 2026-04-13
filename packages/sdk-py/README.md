# foxhound-ai

Open-source observability for AI agent fleets — trace, replay, and audit every agent decision.

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

## OpenTelemetry Bridge

The `FoxhoundSpanProcessor` bridges any framework that emits
[OpenTelemetry GenAI semantic convention](https://opentelemetry.io/docs/specs/semconv/gen-ai/) spans
to Foxhound — one import, zero framework code changes.

```bash
pip install foxhound-ai[opentelemetry]
```

### General setup

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

# Run your agent normally — spans are captured automatically
await processor.flush()
```

### Pydantic AI

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry import trace

from foxhound import FoxhoundClient
from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

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

### Amazon Bedrock AgentCore

Use the `configure_adot_for_foxhound()` convenience helper — it wires up the
TracerProvider and sets it as the global OTel provider in one call:

```python
from foxhound.integrations.opentelemetry import configure_adot_for_foxhound
import boto3

# Set up once at startup — all subsequent Bedrock AgentCore spans are captured
processor = configure_adot_for_foxhound(
    agent_id="bedrock-agent",
    foxhound_endpoint="https://your-foxhound-instance.com",
    api_key="fox_...",
)

# Run your Bedrock AgentCore agent normally
client = boto3.client("bedrock-agent-runtime", region_name="us-east-1")
response = client.invoke_agent(
    agentId="ABCDEF1234",
    agentAliasId="TSTALIASID",
    sessionId="my-session",
    inputText="What is the weather in Seattle?",
)

await processor.flush()
```

You can also supply credentials via environment variables and skip the
`api_key` parameter if your Foxhound instance is configured to accept them:

```bash
export FOXHOUND_API_KEY="fox_..."
export FOXHOUND_ENDPOINT="https://your-foxhound-instance.com"
```

### Google ADK

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

### Coverage note

The OTel bridge captures spans emitted by frameworks as OpenTelemetry GenAI
semantic convention attributes. Framework-specific metadata that is not yet
encoded in those conventions (e.g. per-turn tool call arguments from CrewAI or
LangGraph) is available only via the native callback-based integrations
(`foxhound.integrations.langgraph`, `foxhound.integrations.crewai`), which
have direct access to the raw framework event payloads.

## Viewer

Start the local OSS trace viewer:

```bash
foxhound ui
```

## License

MIT
