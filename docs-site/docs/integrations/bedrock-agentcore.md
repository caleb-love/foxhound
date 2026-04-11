---
title: Amazon Bedrock AgentCore
sidebar_label: Bedrock AgentCore
---

# Amazon Bedrock AgentCore Integration

Foxhound integrates with Amazon Bedrock AgentCore via the OpenTelemetry bridge and a convenience helper that wires everything up in one call.

## Installation

```bash
pip install foxhound-ai[opentelemetry] boto3
```

## Usage

### Using the convenience helper

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

The `configure_adot_for_foxhound()` helper wires up the `TracerProvider` and sets it as the global OTel provider in one call — no manual provider setup required.

### Using environment variables

You can supply credentials via environment variables and skip the `api_key` parameter:

```bash
export FOXHOUND_API_KEY="fox_..."
export FOXHOUND_ENDPOINT="https://your-foxhound-instance.com"
```

```python
processor = configure_adot_for_foxhound(agent_id="bedrock-agent")
```

## What gets traced

- Bedrock AgentCore invocations
- Underlying LLM calls (model, prompt, completion)
- Tool use and knowledge base queries
- Agent orchestration steps

## Related

- [Python SDK Reference →](../sdk/python)
- [OpenTelemetry bridge overview →](./opentelemetry-bridge)
