---
title: Claude Agent SDK
sidebar_label: Claude Agent SDK
---

# Claude Agent SDK Integration

Foxhound integrates with Anthropic's Claude Agent SDK via a dedicated tracer that captures the full agent lifecycle — LLM turns, tool calls, cost, and duration.

## Installation

```bash
npm install @foxhound-ai/sdk
```

## Usage

```typescript
import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundClaudeTracer } from "@foxhound-ai/sdk/integrations/claude-agent";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
});

const tracer = FoxhoundClaudeTracer.fromClient(fox, {
  agentId: "my-claude-agent",
  sessionId: "session_123", // optional
});

// Start the workflow
tracer.startWorkflow("Write a Python script that sorts a list");

// In your agent loop, pass each message to the tracer:
for await (const message of agentStream) {
  tracer.onMessage(message);
}

// End and flush
tracer.endWorkflow();
await tracer.flush();
```

## Tool Hooks

Instrument tool calls by hooking into pre/post execution:

```typescript
// Before tool execution
tracer.onPreToolUse("bash", { command: "ls -la" }, toolUseId);

// After tool execution
tracer.onPostToolUse(toolUseId, "file1.txt\nfile2.txt");

// On tool error
tracer.onPostToolUse(toolUseId, undefined, "Permission denied");
```

## What Gets Traced

| Event | Span Kind | Attributes |
|-------|-----------|------------|
| Agent workflow | `workflow` | `agent.prompt`, `agent.cost_usd`, `agent.duration_ms` |
| LLM turn (AssistantMessage) | `llm_call` | `llm.model`, `llm.prompt_tokens`, `llm.completion_tokens` |
| Tool call | `tool_call` | `tool.name`, `tool.input.*`, `tool.output` |

## Multi-Agent Coordination

For orchestrators that spawn child agents, pass `correlationId` and `parentAgentId` through the trace context:

```typescript
const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
});

// Parent agent
const parentTrace = fox.startTrace({
  agentId: "orchestrator",
  correlationId: "workflow_abc",
});

// Child agent — link back to parent
const childTracer = FoxhoundClaudeTracer.fromClient(fox, {
  agentId: "code-reviewer",
  metadata: {
    parentAgentId: "orchestrator",
    correlationId: "workflow_abc",
  },
});
```

Query the coordination graph via the API:

```bash
curl -H "Authorization: Bearer fox_..." \
  https://api.foxhound.ai/v1/traces/coordination/workflow_abc
```

## Budget Exceeded Callback

Monitor cost limits in real time:

```typescript
const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
  onBudgetExceeded: (info) => {
    console.warn(`Agent ${info.agentId} exceeded budget: $${info.currentCost}/$${info.budgetLimit}`);
  },
});
```

## Related

- [TypeScript SDK Reference →](../sdk/typescript)
- [OpenTelemetry bridge →](./opentelemetry-bridge)
