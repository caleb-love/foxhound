/**
 * Fox SDK — instrument your AI agents for compliance-grade observability.
 *
 * Usage:
 *   import { FoxClient } from "@fox/sdk";
 *   const fox = new FoxClient({ apiKey: process.env.FOX_API_KEY, endpoint: "https://api.fox.ai" });
 *   const trace = fox.startTrace({ agentId: "my-agent" });
 *   const span = trace.startSpan({ name: "tool_call:search", kind: "tool_call" });
 *   span.end();
 *   await trace.flush();
 */

export { FoxClient } from "./client.js";
export { Tracer } from "./tracer.js";
export type { FoxClientOptions } from "./client.js";
