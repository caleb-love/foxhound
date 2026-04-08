/**
 * Claude Agent SDK integration for the Fox observability SDK (TypeScript).
 *
 * Instruments Claude Agent SDK agents by providing hook functions and
 * message observers that produce structured Fox trace spans.
 *
 * Usage:
 *   import { FoxhoundClient } from "@foxhound-ai/sdk";
 *   import { FoxClaudeTracer } from "@foxhound-ai/sdk/integrations/claude-agent";
 *
 *   const fox = new FoxhoundClient({ apiKey: "fox_...", endpoint: "..." });
 *   const tracer = FoxClaudeTracer.fromClient(fox, { agentId: "my-agent" });
 *
 *   tracer.startWorkflow("Write a script");
 *   // ... process messages from the agent loop ...
 *   tracer.onMessage(message);
 *   tracer.endWorkflow();
 *   await tracer.flush();
 */

import type { SpanKind } from "@foxhound/types";
import type { FoxhoundClient } from "../client.js";
import type { Tracer, ActiveSpan } from "../tracer.js";

export interface ClaudeTracerOptions {
  agentId: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export class FoxClaudeTracer {
  private readonly tracer: Tracer;
  private workflowSpan: ActiveSpan | null = null;
  private toolSpans: Map<string, ActiveSpan> = new Map();
  private turnCount = 0;

  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }

  static fromClient(client: FoxhoundClient, options: ClaudeTracerOptions): FoxClaudeTracer {
    const tracer = client.startTrace({
      agentId: options.agentId,
      sessionId: options.sessionId,
      metadata: options.metadata,
    });
    return new FoxClaudeTracer(tracer);
  }

  get traceId(): string {
    return this.tracer.traceId;
  }

  // ------------------------------------------------------------------
  // Workflow lifecycle
  // ------------------------------------------------------------------

  startWorkflow(prompt?: string): void {
    const span = this.tracer.startSpan({ name: "claude-agent", kind: "workflow" });
    this.workflowSpan = span;
    if (prompt) {
      span.setAttribute("agent.prompt", truncate(prompt, 512));
    }
  }

  endWorkflow(status: "ok" | "error" = "ok"): void {
    this.endOpenToolSpans();
    if (this.workflowSpan) {
      this.workflowSpan.end(status);
      this.workflowSpan = null;
    }
  }

  async flush(): Promise<void> {
    this.endOpenToolSpans();
    await this.tracer.flush();
  }

  // ------------------------------------------------------------------
  // Message observer
  // ------------------------------------------------------------------

  onMessage(message: unknown): void {
    const msgType = (message as { constructor?: { name?: string } })?.constructor?.name;

    if (msgType === "AssistantMessage") {
      this.turnCount++;
      const parentSpanId = this.workflowSpan?.spanId;
      const span = this.tracer.startSpan({
        name: `llm:claude:turn-${this.turnCount}`,
        kind: "llm_call" as SpanKind,
        parentSpanId,
      });

      const msg = message as Record<string, unknown>;
      if (msg["model"]) {
        span.setAttribute("llm.model", String(msg["model"]));
      }

      const usage = msg["usage"] as Record<string, unknown> | undefined;
      if (usage) {
        if (typeof usage["input_tokens"] === "number") {
          span.setAttribute("llm.prompt_tokens", usage["input_tokens"]);
        }
        if (typeof usage["output_tokens"] === "number") {
          span.setAttribute("llm.completion_tokens", usage["output_tokens"]);
        }
      }

      span.end("ok");
    } else if (msgType === "ResultMessage") {
      const msg = message as Record<string, unknown>;
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

  onPreToolUse(toolName: string, toolInput: Record<string, unknown>, toolUseId: string): void {
    const parentSpanId = this.workflowSpan?.spanId;
    const span = this.tracer.startSpan({
      name: `tool:${toolName}`,
      kind: "tool_call" as SpanKind,
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

  onPostToolUse(toolUseId: string, result?: string, error?: string): void {
    const span = this.toolSpans.get(toolUseId);
    if (!span) return;
    this.toolSpans.delete(toolUseId);

    if (result) {
      span.setAttribute("tool.output", truncate(result, 1024));
    }

    if (error) {
      span.addEvent("error", { message: error });
      span.end("error");
    } else {
      span.end("ok");
    }
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private endOpenToolSpans(): void {
    for (const span of this.toolSpans.values()) {
      span.addEvent("warning", { message: "Tool span not closed" });
      span.end("error");
    }
    this.toolSpans.clear();
  }
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}
