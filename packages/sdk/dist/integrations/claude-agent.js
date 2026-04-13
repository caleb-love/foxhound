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
export class FoxhoundClaudeTracer {
    tracer;
    workflowSpan = null;
    toolSpans = new Map();
    turnCount = 0;
    constructor(tracer) {
        this.tracer = tracer;
    }
    static fromClient(client, options) {
        const tracer = client.startTrace({
            agentId: options.agentId,
            sessionId: options.sessionId,
            metadata: options.metadata,
        });
        return new FoxhoundClaudeTracer(tracer);
    }
    get traceId() {
        return this.tracer.traceId;
    }
    // ------------------------------------------------------------------
    // Workflow lifecycle
    // ------------------------------------------------------------------
    startWorkflow(prompt) {
        const span = this.tracer.startSpan({ name: "claude-agent", kind: "workflow" });
        this.workflowSpan = span;
        if (prompt) {
            span.setAttribute("agent.prompt", truncate(prompt, 512));
        }
    }
    endWorkflow(status = "ok") {
        this.endOpenToolSpans();
        if (this.workflowSpan) {
            this.workflowSpan.end(status);
            this.workflowSpan = null;
        }
    }
    async flush() {
        this.endOpenToolSpans();
        await this.tracer.flush();
    }
    // ------------------------------------------------------------------
    // Message observer
    // ------------------------------------------------------------------
    onMessage(message) {
        const msgType = message?.constructor?.name;
        if (msgType === "AssistantMessage") {
            this.turnCount++;
            const parentSpanId = this.workflowSpan?.spanId;
            const span = this.tracer.startSpan({
                name: `llm:claude:turn-${this.turnCount}`,
                kind: "llm_call",
                parentSpanId,
            });
            const msg = message;
            if (msg["model"]) {
                span.setAttribute("llm.model", String(msg["model"]));
            }
            const usage = msg["usage"];
            if (usage) {
                if (typeof usage["input_tokens"] === "number") {
                    span.setAttribute("llm.prompt_tokens", usage["input_tokens"]);
                }
                if (typeof usage["output_tokens"] === "number") {
                    span.setAttribute("llm.completion_tokens", usage["output_tokens"]);
                }
            }
            span.end("ok");
        }
        else if (msgType === "ResultMessage") {
            const msg = message;
            if (typeof msg["cost_usd"] === "number" && this.workflowSpan) {
                this.workflowSpan.setAttribute("agent.cost_usd", msg["cost_usd"]);
            }
            if (typeof msg["duration_ms"] === "number" && this.workflowSpan) {
                this.workflowSpan.setAttribute("agent.duration_ms", msg["duration_ms"]);
            }
        }
    }
    // ------------------------------------------------------------------
    // Tool hooks
    // ------------------------------------------------------------------
    onPreToolUse(toolName, toolInput, toolUseId) {
        const parentSpanId = this.workflowSpan?.spanId;
        const span = this.tracer.startSpan({
            name: `tool:${toolName}`,
            kind: "tool_call",
            parentSpanId,
        });
        span.setAttribute("tool.name", toolName);
        for (const [key, value] of Object.entries(toolInput)) {
            if (value !== null && value !== undefined) {
                span.setAttribute(`tool.input.${key}`, truncate(String(value), 512));
            }
        }
        this.toolSpans.set(toolUseId, span);
    }
    onPostToolUse(toolUseId, result, error) {
        const span = this.toolSpans.get(toolUseId);
        if (!span)
            return;
        this.toolSpans.delete(toolUseId);
        if (result) {
            span.setAttribute("tool.output", truncate(result, 1024));
        }
        if (error) {
            span.addEvent("error", { message: error });
            span.end("error");
        }
        else {
            span.end("ok");
        }
    }
    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------
    endOpenToolSpans() {
        for (const span of this.toolSpans.values()) {
            span.addEvent("warning", { message: "Tool span not closed" });
            span.end("error");
        }
        this.toolSpans.clear();
    }
}
function truncate(s, maxLen) {
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}
//# sourceMappingURL=claude-agent.js.map