# @foxhound-ai/sdk

TypeScript SDK for Foxhound, the observability platform for AI agent systems.

Foxhound helps you trace agent execution, inspect tool and model behavior, manage prompt versions, run evaluations, monitor budgets and SLAs, and detect regressions across agent versions.

## Install

```bash
npm install @foxhound-ai/sdk
```

## What this package is for

Use the SDK when you want to:

- instrument TypeScript or Node.js agent runtimes
- record traces and spans for LLM calls, tool calls, and workflow steps
- fetch managed prompts by name and label
- configure budgets and SLA thresholds
- create datasets and experiments from production traces
- compare agent versions for behavioral regressions
- bridge OpenTelemetry spans into Foxhound

## Quick start

```ts
import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "http://localhost:3000",
});

const trace = fox.startTrace({ agentId: "support-agent" });
const span = trace.startSpan({ name: "tool:search", kind: "tool_call" });
span.setAttribute("query", "refund policy");
span.end();
await trace.flush();
await fox.shutdown();
```

## Core capabilities

### Tracing

```ts
const trace = fox.startTrace({
  agentId: "support-agent",
  sessionId: "session-123",
  metadata: { workflow: "refunds" },
});

const llmSpan = trace.startSpan({ name: "llm:answer", kind: "llm_call" });
llmSpan.setAttribute("model", "claude-sonnet-4");
llmSpan.setAttribute("tokens.prompt", 1200);
llmSpan.setAttribute("tokens.completion", 260);
llmSpan.setAttribute("cost", 0.0142);
llmSpan.end();

await trace.flush();
await fox.shutdown();
```

`trace.flush()` queues the completed trace for background export. Call `fox.shutdown()` during process shutdown when you need to drain queued traces before exit.

### Prompt management

```ts
const prompt = await fox.prompts.get({
  name: "support-agent-system",
  label: "production",
});

console.log(prompt.content);
console.log(prompt.model);
console.log(prompt.config);
```

### Budgets

```ts
await fox.budgets.set({
  agentId: "support-agent",
  costBudgetUsd: 100,
  costAlertThresholdPct: 80,
  budgetPeriod: "daily",
});
```

### SLAs

```ts
await fox.slas.set({
  agentId: "support-agent",
  maxDurationMs: 5000,
  minSuccessRate: 0.95,
  evaluationWindowMs: 60 * 60 * 1000,
  minSampleSize: 10,
});
```

### Regression comparison

```ts
const report = await fox.regressions.compare({
  agentId: "support-agent",
  versionA: "v1.2.0",
  versionB: "v1.3.0",
});

console.log(report);
```

### Datasets and experiments

```ts
const dataset = await fox.datasets.create({
  name: "support-golden-set",
  description: "High-quality support traces",
});

await fox.datasets.fromTraces(dataset.id, {
  traceIds: ["trace_1", "trace_2"],
});

const experiment = await fox.experiments.create({
  datasetId: dataset.id,
  name: "support-agent-v1-3-0",
  config: { temperature: 0.2 },
});

console.log(experiment);
```

## OpenTelemetry integration

Use the OpenTelemetry bridge when your framework already emits spans and you want to forward them into Foxhound.

```ts
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "http://localhost:3000",
});

const provider = new NodeTracerProvider();
const processor = FoxhoundSpanProcessor.fromClient(fox, {
  agentId: "my-agent",
});

provider.addSpanProcessor(processor);
trace.setGlobalTracerProvider(provider);

await processor.forceFlush();
```

## Multi-agent propagation

```ts
const headers = fox.getPropagationHeaders({
  correlationId: "task-123",
  parentAgentId: "router-agent",
});
```

Use those headers when one agent invokes another so traces remain linked across the workflow.

## Configuration

`FoxhoundClient` expects:

- `apiKey`: your Foxhound API key
- `endpoint`: the Foxhound API base URL

Batch export options:

- `maxQueueSize`: in-memory export queue size, default `2048`; set `0` to disable background export in tests
- `maxExportBatchSize`: traces per export tick, default `512`
- `exportScheduleDelayMs`: export pump interval, default `2000`
- `backpressurePolicy`: `drop-oldest` by default, also supports `drop-newest` and `block`

Typical local endpoint:

- `http://localhost:3000`

Typical hosted endpoint:

- your deployed Foxhound API URL

## Related packages

- `@foxhound-ai/mcp-server` — query Foxhound from MCP clients such as Claude Code and Cursor
- `@foxhound-ai/cli` — command-line access to Foxhound operations

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## License

All rights reserved. This package is public for reference and evaluation only.
No permission is granted to use, copy, modify, distribute, sublicense, or sell it without prior written permission.
See the repository [LICENSE](../../LICENSE) and contact hello@caleb-love.com for licensing inquiries.
