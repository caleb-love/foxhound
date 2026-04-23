/**
 * Fox SDK — instrument your AI agents for production-grade observability.
 *
 * Usage:
 *   import { FoxhoundClient } from "@foxhound-ai/sdk";
 *   const fox = new FoxhoundClient({ apiKey: process.env.FOXHOUND_API_KEY, endpoint: "https://api.foxhound.ai" });
 *   const trace = fox.startTrace({ agentId: "my-agent" });
 *   const span = trace.startSpan({ name: "tool_call:search", kind: "tool_call" });
 *   span.end();
 *   await trace.flush();
 */

export { FoxhoundClient } from "./client.js";
export { Tracer } from "./tracer.js";
export type {
  BudgetExceededInfo,
  FoxhoundClientOptions,
  ResolvedPrompt,
  PromptGetParams,
} from "./client.js";

// Batch export processor (WP06) — non-blocking queue-backed export.
export { BatchSpanProcessor } from "./transport/batch-processor.js";
export type { BatchProcessorConfig, BackpressurePolicy } from "./transport/batch-processor.js";

// Agent-scope helpers (WP15) — multi-agent trace attribution.
export { withAgent, withAgentSync, startAgentSpan, currentAgentScope } from "./helpers/index.js";
