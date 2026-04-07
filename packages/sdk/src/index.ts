/**
 * Fox SDK — instrument your AI agents for compliance-grade observability.
 *
 * Usage:
 *   import { FoxhoundClient } from "@foxhound/sdk";
 *   const fox = new FoxhoundClient({ apiKey: process.env.FOXHOUND_API_KEY, endpoint: "https://api.foxhound.ai" });
 *   const trace = fox.startTrace({ agentId: "my-agent" });
 *   const span = trace.startSpan({ name: "tool_call:search", kind: "tool_call" });
 *   span.end();
 *   await trace.flush();
 */

export { FoxhoundClient } from "./client.js";
export { Tracer } from "./tracer.js";
export type { FoxhoundClientOptions } from "./client.js";
