/**
 * Claude Agent SDK integration for the Fox observability SDK (TypeScript).
 *
 * Instruments Claude Agent SDK agents by providing hook functions and
 * message observers that produce structured Fox trace spans.
 *
 * Usage:
 *   import { FoxhoundClient } from "@foxhound-ai/sdk";
 *   import { FoxhoundClaudeTracer } from "@foxhound-ai/sdk/integrations/claude-agent";
 *
 *   const fox = new FoxhoundClient({ apiKey: "fox_...", endpoint: "..." });
 *   const tracer = FoxhoundClaudeTracer.fromClient(fox, { agentId: "my-agent" });
 *
 *   tracer.startWorkflow("Write a script");
 *   // ... process messages from the agent loop ...
 *   tracer.onMessage(message);
 *   tracer.endWorkflow();
 *   await tracer.flush();
 */
import type { FoxhoundClient } from "../client.js";
import type { Tracer } from "../tracer.js";
export interface ClaudeTracerOptions {
    agentId: string;
    sessionId?: string;
    metadata?: Record<string, string | number | boolean | null>;
}
export declare class FoxhoundClaudeTracer {
    private readonly tracer;
    private workflowSpan;
    private toolSpans;
    private turnCount;
    constructor(tracer: Tracer);
    static fromClient(client: FoxhoundClient, options: ClaudeTracerOptions): FoxhoundClaudeTracer;
    get traceId(): string;
    startWorkflow(prompt?: string): void;
    endWorkflow(status?: "ok" | "error"): void;
    flush(): Promise<void>;
    onMessage(message: unknown): void;
    onPreToolUse(toolName: string, toolInput: Record<string, unknown>, toolUseId: string): void;
    onPostToolUse(toolUseId: string, result?: string, error?: string): void;
    private endOpenToolSpans;
}
//# sourceMappingURL=claude-agent.d.ts.map