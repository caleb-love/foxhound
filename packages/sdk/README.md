# @foxhound-ai/sdk

> **Production-grade observability for AI agent fleets**  
> Trace, replay, and audit every agent decision — from prototype to production.

[![npm version](https://img.shields.io/npm/v/@foxhound-ai/sdk.svg)](https://www.npmjs.com/package/@foxhound-ai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Why Foxhound?

AI agents fail in production in ways you can't predict during development. Foxhound gives you **session replay for agents** — watch exactly what your agent saw, thought, and did, then rewind and fix it.

**Built for agent developers who ship to production:**
- 🎬 **Session Replay** — Time-travel debug: see every LLM call, tool invocation, and decision
- 💰 **Cost Budgets** — Set spending limits per agent, get alerts before runaway costs
- 📊 **SLA Monitoring** — Track response times and success rates, catch regressions early
- 🔬 **Run Diff** — Compare two agent runs side-by-side to understand behavioral changes
- 🧪 **Eval from Traces** — Turn production traces into golden test sets automatically
- 🔌 **Framework Agnostic** — Works with any TypeScript agent framework via OpenTelemetry

---

## Installation

```bash
npm install @foxhound-ai/sdk
# or
pnpm add @foxhound-ai/sdk
# or
yarn add @foxhound-ai/sdk
```

---

## Quickstart

### 1. Basic Tracing

```typescript
import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!, // Get API key at foxhound.caleb-love.com
  endpoint: "https://api.foxhound.ai",
});

// Start a trace for your agent
const trace = fox.startTrace({ 
  agentId: "customer-support-agent",
  sessionId: "user-123-session-456", // Optional: correlate with your user sessions
});

// Record an LLM call
const llmSpan = trace.startSpan({ 
  name: "llm:generate", 
  kind: "llm_call" 
});
llmSpan.setAttribute("model", "claude-3-5-sonnet-20241022");
llmSpan.setAttribute("prompt", "You are a helpful customer support agent...");
llmSpan.setAttribute("response", "I'd be happy to help you with that!");
llmSpan.setAttribute("tokens.prompt", 150);
llmSpan.setAttribute("tokens.completion", 75);
llmSpan.setAttribute("cost", 0.0045);
llmSpan.end();

// Record a tool call
const toolSpan = trace.startSpan({ 
  name: "tool:database_query", 
  kind: "tool_call" 
});
toolSpan.setAttribute("query", "SELECT * FROM orders WHERE user_id = ?");
toolSpan.setAttribute("result", JSON.stringify({ orders: [...] }));
toolSpan.end();

// Flush to Foxhound
await trace.flush();
```

### 2. Set Cost Budgets (Prevent Runaway Costs)

```typescript
// Set a $100/day budget for your agent
await fox.budgets.set({
  agentId: "customer-support-agent",
  costBudgetUsd: 100,
  costAlertThresholdPct: 80, // Alert at 80% of budget
  budgetPeriod: "daily",
});

// Get real-time alerts when budget is exceeded
const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
  onBudgetExceeded: ({ agentId, currentCost, budgetLimit }) => {
    console.error(`⚠️  Agent ${agentId} exceeded budget!`);
    console.error(`   Current: $${currentCost} | Limit: $${budgetLimit}`);
    // Trigger your alerting system (PagerDuty, Slack, etc.)
  },
});
```

### 3. Monitor SLAs (Catch Performance Regressions)

```typescript
// Define performance contract: 95% success rate, max 5s response time
await fox.slas.set({
  agentId: "customer-support-agent",
  maxDurationMs: 5000,
  minSuccessRate: 0.95,
  evaluationWindowMs: 3600000, // 1 hour rolling window
  minSampleSize: 10,
});

// Check SLA status
const sla = await fox.slas.get("customer-support-agent");
console.log(`Current success rate: ${sla.metrics.successRate}`);
console.log(`P95 duration: ${sla.metrics.p95DurationMs}ms`);
```

### 4. Detect Behavioral Regressions

```typescript
// Compare two versions of your agent
const diff = await fox.regressions.compare({
  agentId: "customer-support-agent",
  versionA: "v1.2.0",
  versionB: "v1.3.0",
});

console.log(`Cost change: ${diff.costDelta}%`);
console.log(`Accuracy change: ${diff.accuracyDelta}%`);
console.log(`New failure modes: ${diff.newFailures.length}`);
```

### 5. Build Test Sets from Production (Eval from Traces)

```typescript
// Create a dataset from your best production traces
const dataset = await fox.datasets.create({
  name: "support-golden-set",
  description: "High-quality customer support interactions",
});

// Add production traces that worked well
await fox.datasets.fromTraces(dataset.id, {
  traceIds: ["trace_abc123", "trace_def456", "trace_ghi789"],
  includeOutput: true, // Include agent responses as expected outputs
});

// Run an experiment against the dataset
const experiment = await fox.experiments.create({
  datasetId: dataset.id,
  name: "v1.3.0-eval",
  config: { model: "claude-3-5-sonnet-20241022", temperature: 0.7 },
});

// Compare experiments to see which config performs best
const comparison = await fox.experiments.compare([
  "exp_v1_2_0",
  "exp_v1_3_0",
]);
console.log(`Winner: ${comparison.winner}`);
```

### 6. Prompt Management (GitOps for Prompts)

```typescript
// Fetch prompts from Foxhound instead of hardcoding
const prompt = await fox.prompts.get({
  name: "support-agent-system",
  label: "production", // or "staging", "experiment-A", etc.
});

console.log(prompt.content); // The prompt template
console.log(prompt.model);   // Recommended model
console.log(prompt.config);  // Temperature, max_tokens, etc.

// Results are cached client-side (5min TTL) for performance
// Invalidate cache when you deploy a new prompt version
fox.prompts.invalidate({ name: "support-agent-system" });
```

---

## OpenTelemetry Bridge

The `FoxhoundSpanProcessor` bridges **any framework that emits OpenTelemetry GenAI semantic conventions** to Foxhound — zero framework code changes required.

### Supported Frameworks

Works automatically with any TypeScript framework that emits OTel GenAI spans:
- ✅ **Mastra** (see example below)
- ✅ **Vercel AI SDK**
- ✅ **LlamaIndex.TS**
- ✅ **LangChain.js** (with OTel instrumentation)
- ✅ **Any custom agent framework** using `@opentelemetry/api`

### General Setup

```bash
npm install @foxhound-ai/sdk @opentelemetry/api @opentelemetry/sdk-trace-node
```

```typescript
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
});

const processor = FoxhoundSpanProcessor.fromClient(fox, {
  agentId: "my-agent",
});

const provider = new NodeTracerProvider();
provider.addSpanProcessor(processor);
trace.setGlobalTracerProvider(provider);

// Your framework emits spans automatically now
// ... run your agent ...

await processor.forceFlush(); // Ensure all spans are sent
```

### Mastra Integration

```typescript
import { Mastra } from "@mastra/core";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { FoxhoundClient } from "@foxhound-ai/sdk";
import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
});

const foxProcessor = FoxhoundSpanProcessor.fromClient(fox, {
  agentId: "mastra-agent",
});

// Register the processor BEFORE Mastra starts
const sdk = new NodeSDK({
  spanProcessors: [foxProcessor],
});
sdk.start();

// Create your Mastra instance normally
const mastra = new Mastra({
  agents: { supportAgent },
  telemetry: {
    serviceName: "customer-support",
    enabled: true,
  },
});

const agent = mastra.getAgent("supportAgent");
const result = await agent.generate("Help me track my order");

await foxProcessor.forceFlush();
```

### Coverage Note

The OTel bridge captures all spans emitted as OpenTelemetry GenAI semantic conventions. Framework-specific metadata not yet standardized in those conventions requires native integrations (coming soon for popular frameworks).

---

## Multi-Agent Orchestration

### Trace Propagation (Distributed Tracing)

When one agent calls another, propagate trace context to connect them:

```typescript
// Agent A starts a trace
const traceA = fox.startTrace({ 
  agentId: "orchestrator",
  correlationId: "user-task-123", // Ties all agents together
});

// Agent A calls Agent B — propagate context
const headers = fox.getPropagationHeaders({
  correlationId: "user-task-123",
  parentAgentId: "orchestrator",
});

const response = await fetch("https://agent-b.example.com/invoke", {
  method: "POST",
  headers: {
    ...headers, // Pass X-Foxhound-Correlation-Id and X-Foxhound-Parent-Agent-Id
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ task: "analyze sentiment" }),
});

// In Agent B's code:
const traceB = fox.startTrace({
  agentId: "sentiment-analyzer",
  correlationId: req.headers["x-foxhound-correlation-id"],
  parentAgentId: req.headers["x-foxhound-parent-agent-id"],
});

// Now both traces are linked in Foxhound's UI
```

---

## API Reference

### Client Initialization

```typescript
const fox = new FoxhoundClient({
  apiKey: string;              // Required: Your Foxhound API key
  endpoint: string;            // Required: API endpoint (https://api.foxhound.ai)
  flushIntervalMs?: number;    // Optional: Auto-flush interval (default: 5000ms)
  maxBatchSize?: number;       // Optional: Max traces per batch (default: 100)
  onBudgetExceeded?: (info: BudgetExceededInfo) => void; // Optional: Budget alert callback
});
```

### Tracing

#### `fox.startTrace(params)`

```typescript
const trace = fox.startTrace({
  agentId: string;              // Required: Unique agent identifier
  sessionId?: string;           // Optional: User/session correlation
  parentAgentId?: string;       // Optional: For multi-agent orchestration
  correlationId?: string;       // Optional: Ties multiple agents together
  metadata?: Record<string, string | number | boolean | null>;
});
```

#### `trace.startSpan(params)`

```typescript
const span = trace.startSpan({
  name: string;                 // Required: Span name (e.g., "llm:generate")
  kind: "llm_call" | "tool_call" | "agent" | "workflow";
});

span.setAttribute(key: string, value: string | number | boolean);
span.setStatus(status: "ok" | "error", message?: string);
span.end();
```

#### `trace.flush()`

```typescript
await trace.flush(); // Sends all spans to Foxhound
```

### Scores

```typescript
await fox.scores.create({
  traceId: string;              // Required: Trace ID
  spanId?: string;              // Optional: Specific span
  name: string;                 // Required: Score name (e.g., "accuracy")
  value?: number;               // Optional: Numeric score (0-1)
  label?: string;               // Optional: String label (e.g., "good", "bad")
  source?: "sdk" | "human" | "llm_judge" | "rule";
  comment?: string;             // Optional: Explanation
});
```

### Cost Budgets

```typescript
// Set budget
await fox.budgets.set({
  agentId: string;
  costBudgetUsd: number;        // Daily/weekly/monthly budget
  costAlertThresholdPct?: number; // Alert at X% of budget (default: 80)
  budgetPeriod?: "daily" | "weekly" | "monthly";
});

// Get budget
const budget = await fox.budgets.get(agentId);

// List all budgets
const budgets = await fox.budgets.list();

// Delete budget
await fox.budgets.delete(agentId);
```

### SLAs

```typescript
// Set SLA
await fox.slas.set({
  agentId: string;
  maxDurationMs?: number;       // Max response time (P95)
  minSuccessRate?: number;      // Min success rate (0-1)
  evaluationWindowMs?: number;  // Rolling window (default: 1 hour)
  minSampleSize?: number;       // Min samples for evaluation
});

// Get SLA
const sla = await fox.slas.get(agentId);

// List all SLAs
const slas = await fox.slas.list();

// Delete SLA
await fox.slas.delete(agentId);
```

### Regression Detection

```typescript
// Compare two versions
const diff = await fox.regressions.compare({
  agentId: string;
  versionA: string;
  versionB: string;
});

// Get all baselines
const baselines = await fox.regressions.baselines(agentId);

// Delete a baseline
await fox.regressions.deleteBaseline({
  agentId: string;
  version: string;
});
```

### Datasets

```typescript
// Create dataset
const dataset = await fox.datasets.create({
  name: string;
  description?: string;
});

// Add items manually
await fox.datasets.addItems(datasetId, [
  {
    input: { query: "What is my order status?" },
    expectedOutput: { answer: "Your order #12345 shipped today." },
    metadata: { source: "production", quality: "high" },
  },
]);

// Build dataset from production traces
await fox.datasets.fromTraces(datasetId, {
  traceIds: string[];
  includeOutput?: boolean;
});

// List datasets
const datasets = await fox.datasets.list();

// Get dataset
const dataset = await fox.datasets.get(datasetId);

// Delete dataset
await fox.datasets.delete(datasetId);
```

### Experiments

```typescript
// Create experiment
const experiment = await fox.experiments.create({
  datasetId: string;
  name: string;
  config?: Record<string, unknown>; // Model config, hyperparams, etc.
});

// List experiments
const experiments = await fox.experiments.list({
  datasetId?: string; // Optional: filter by dataset
});

// Get experiment
const experiment = await fox.experiments.get(experimentId);

// Compare experiments
const comparison = await fox.experiments.compare([
  "exp_id_1",
  "exp_id_2",
  "exp_id_3",
]);

// Delete experiment
await fox.experiments.delete(experimentId);
```

### Prompts

```typescript
// Get prompt by name and label
const prompt = await fox.prompts.get({
  name: string;
  label?: string; // Default: "production"
});
// Returns: { name, label, version, content, model, config }

// Invalidate cache for specific prompt
fox.prompts.invalidate({ name: string, label?: string });

// Invalidate all cached prompts
fox.prompts.invalidate();
```

### Trace Propagation

```typescript
const headers = fox.getPropagationHeaders({
  correlationId?: string;
  parentAgentId?: string;
});
// Returns: { "X-Foxhound-Correlation-Id", "X-Foxhound-Parent-Agent-Id" }
```

---

## Best Practices

### 1. Use Descriptive Span Names

```typescript
// ❌ Bad
span.name = "llm";

// ✅ Good
span.name = "llm:generate_support_response";
span.name = "tool:search_knowledge_base";
span.name = "agent:customer_support_flow";
```

### 2. Always Set Cost Attributes

```typescript
llmSpan.setAttribute("cost", 0.0045); // USD
llmSpan.setAttribute("tokens.prompt", 150);
llmSpan.setAttribute("tokens.completion", 75);
llmSpan.setAttribute("model", "claude-3-5-sonnet-20241022");
```

### 3. Use Session IDs for User Correlation

```typescript
const trace = fox.startTrace({
  agentId: "support-agent",
  sessionId: req.user.id, // Correlate with your user sessions
});
```

### 4. Set Budgets Early (Prevent Surprises)

```typescript
// Set budgets in your deployment script or infrastructure code
await fox.budgets.set({
  agentId: process.env.AGENT_ID!,
  costBudgetUsd: parseFloat(process.env.AGENT_BUDGET_USD!),
  costAlertThresholdPct: 80,
});
```

### 5. Build Test Sets Continuously

```typescript
// After each successful production run, consider adding it to your test set
if (userFeedback === "positive") {
  await fox.datasets.fromTraces(GOLDEN_DATASET_ID, {
    traceIds: [trace.id],
    includeOutput: true,
  });
}
```

### 6. Version Your Agents

```typescript
const trace = fox.startTrace({
  agentId: "support-agent",
  metadata: {
    version: "v1.3.0", // Tag every trace with version
    commit: process.env.GIT_COMMIT_SHA,
  },
});
```

---

## Local Development

### Run the Trace Viewer Locally

```bash
npx foxhound ui
```

Open [http://localhost:3000](http://localhost:3000) to view traces, session replays, and analytics.

---

## Examples

### Complete Agent with All Features

```typescript
import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://api.foxhound.ai",
  onBudgetExceeded: ({ agentId, currentCost, budgetLimit }) => {
    notifySlack(`Agent ${agentId} exceeded budget: $${currentCost}/$${budgetLimit}`);
  },
});

// Set guardrails
await fox.budgets.set({
  agentId: "customer-support",
  costBudgetUsd: 100,
  budgetPeriod: "daily",
});

await fox.slas.set({
  agentId: "customer-support",
  maxDurationMs: 5000,
  minSuccessRate: 0.95,
});

// Get prompt from management system
const systemPrompt = await fox.prompts.get({
  name: "support-system-prompt",
  label: process.env.ENVIRONMENT, // "production" or "staging"
});

// Run agent
async function handleCustomerQuery(query: string, userId: string) {
  const trace = fox.startTrace({
    agentId: "customer-support",
    sessionId: userId,
    metadata: {
      version: "v1.3.0",
      environment: process.env.ENVIRONMENT,
    },
  });

  const llmSpan = trace.startSpan({ name: "llm:generate", kind: "llm_call" });
  
  try {
    const response = await anthropic.messages.create({
      model: systemPrompt.model,
      messages: [{ role: "user", content: query }],
      system: systemPrompt.content,
    });

    llmSpan.setAttribute("model", systemPrompt.model);
    llmSpan.setAttribute("prompt", query);
    llmSpan.setAttribute("response", response.content[0].text);
    llmSpan.setAttribute("tokens.prompt", response.usage.input_tokens);
    llmSpan.setAttribute("tokens.completion", response.usage.output_tokens);
    llmSpan.setAttribute("cost", calculateCost(response.usage));
    llmSpan.setStatus("ok");

    return response.content[0].text;
  } catch (error) {
    llmSpan.setStatus("error", error.message);
    throw error;
  } finally {
    llmSpan.end();
    await trace.flush();
  }
}
```

---

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { 
  FoxhoundClientOptions,
  BudgetExceededInfo,
  ResolvedPrompt,
  PromptGetParams,
} from "@foxhound-ai/sdk";
```

---

## Links

- **Documentation:** [https://docs.foxhound.caleb-love.com](https://docs.foxhound.caleb-love.com)
- **GitHub:** [https://github.com/caleb-love/foxhound](https://github.com/caleb-love/foxhound)
- **Homepage:** [https://foxhound.caleb-love.com](https://foxhound.caleb-love.com)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

---

## License

MIT © [Foxhound](https://foxhound.caleb-love.com)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/caleb-love/foxhound/issues)
- **Discord:** [Join our community](https://discord.gg/foxhound) *(coming soon)*
- **Email:** foxhound@caleb-love.com
