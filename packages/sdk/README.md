# @foxhound-ai/sdk

Open-source observability for AI agent fleets — trace, replay, and audit every agent decision.

## Installation

```bash
npm install @foxhound-ai/sdk
# or
pnpm add @foxhound-ai/sdk
```

## Quickstart

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

## OpenTelemetry Bridge

The `FoxhoundSpanProcessor` bridges any framework that emits
[OpenTelemetry GenAI semantic convention](https://opentelemetry.io/docs/specs/semconv/gen-ai/) spans
to Foxhound — one import, zero framework code changes.

Any TypeScript framework that emits OTel GenAI semantic convention spans works
with this bridge automatically (Mastra, Vercel AI SDK, LlamaIndex.TS, etc.).

```bash
npm install @foxhound-ai/sdk @opentelemetry/api @opentelemetry/sdk-node
```

### General setup

```typescript
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: "fox_...",
  endpoint: "https://your-foxhound-instance.com",
});
const processor = FoxhoundSpanProcessor.fromClient(fox, {
  agentId: "my-agent",
});

const provider = new NodeTracerProvider();
provider.addSpanProcessor(processor);
trace.setGlobalTracerProvider(provider);

// Run your agent normally — spans are captured automatically
await processor.forceFlush();
```

### Mastra

Mastra supports custom OTel exporters via its `telemetry` configuration block.
Wire `FoxhoundSpanProcessor` as a span processor so every Mastra agent workflow
is captured without modifying agent code:

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

### Coverage note

The OTel bridge captures all spans emitted by frameworks as OpenTelemetry GenAI
semantic convention attributes.  Framework-specific metadata not yet encoded in
those conventions is only available via native callback-based integrations where
the SDK has direct access to raw framework event payloads.

## Viewer

Start the local OSS trace viewer:

```bash
npx foxhound ui
```

## License

MIT
