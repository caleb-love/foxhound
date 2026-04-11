---
title: Mastra
sidebar_label: Mastra
---

# Mastra Integration

Foxhound integrates with Mastra via the OpenTelemetry span processor bridge. Mastra emits OTel GenAI semantic convention spans natively, so no framework-specific hooks are needed.

## Installation

```bash
npm install @foxhound-ai/sdk @opentelemetry/api @opentelemetry/sdk-node @mastra/core
```

## Usage

Wire `FoxhoundSpanProcessor` as a span processor before Mastra starts:

```typescript
import { Mastra } from "@mastra/core";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: "fox_...",
  endpoint: "https://your-foxhound-instance.com",
});
const foxProcessor = FoxhoundSpanProcessor.fromClient(fox, {
  agentId: "my-mastra-agent",
});

// Register the processor with the Node OTel SDK before Mastra starts
const sdk = new NodeSDK({
  spanProcessors: [foxProcessor],
});
sdk.start();

// Create your Mastra instance normally
const mastra = new Mastra({
  agents: { myAgent },
  telemetry: {
    serviceName: "my-mastra-app",
    enabled: true,
  },
});

const agent = mastra.getAgent("myAgent");
const result = await agent.generate("Summarise the latest AI safety research.");
await foxProcessor.forceFlush();
```

## What gets traced

All spans emitted by Mastra as OTel GenAI semantic convention attributes are forwarded to Foxhound, including:

- Agent workflow executions
- LLM calls (model, prompt, completion, token counts)
- Tool invocations
- Step transitions

## Related

- [TypeScript SDK Reference →](../sdk/typescript)
- [OpenTelemetry bridge overview →](./opentelemetry-bridge)
