import { randomUUID } from "node:crypto";
import type { Span, SpanKind, Trace } from "@foxhound/types";
import { currentAgentScope } from "./helpers/agent.js";

interface TracerOptions {
  agentId: string;
  sessionId?: string;
  metadata: Record<string, string | number | boolean | null>;
  onFlush: (trace: Trace) => Promise<void>;
}

export class Tracer {
  readonly traceId: string;
  private readonly options: TracerOptions;
  private readonly spans: Map<string, Span> = new Map();
  private readonly startTimeMs: number;

  constructor(options: TracerOptions) {
    this.traceId = randomUUID();
    this.options = options;
    this.startTimeMs = Date.now();
  }

  startSpan(params: {
    name: string;
    kind: SpanKind;
    parentSpanId?: string;
    attributes?: Record<string, string | number | boolean | null>;
    /**
     * Per-span agent scope (WP15). Overrides the trace-level agentId
     * on the wire. When omitted, the tracer consults the `withAgent(...)`
     * stack; if that is also empty, the trace-level `agentId` applies.
     */
    agentId?: string;
  }): ActiveSpan {
    // Resolution order: explicit param > withAgent(...) scope > unset
    // (in which case the wire encoder falls back to the trace-level
    // agentId at map time).
    const scopedAgentId = params.agentId ?? currentAgentScope(this);
    const span: Span = {
      traceId: this.traceId,
      spanId: randomUUID(),
      parentSpanId: params.parentSpanId,
      name: params.name,
      kind: params.kind,
      startTimeMs: Date.now(),
      status: "unset",
      attributes: params.attributes ?? {},
      events: [],
      ...(scopedAgentId !== undefined ? { agentId: scopedAgentId } : {}),
    };
    this.spans.set(span.spanId, span);
    return new ActiveSpan(span, this.spans);
  }

  /**
   * Attach prompt version info to this trace's metadata.
   * Called automatically when using a resolved prompt with this trace.
   */
  setPrompt(params: { name: string; version: number; label?: string }): this {
    this.options.metadata["prompt_name"] = params.name;
    this.options.metadata["prompt_version"] = params.version;
    if (params.label) {
      this.options.metadata["prompt_label"] = params.label;
    }
    return this;
  }

  async flush(): Promise<void> {
    const trace: Trace = {
      id: this.traceId,
      agentId: this.options.agentId,
      sessionId: this.options.sessionId,
      spans: Array.from(this.spans.values()),
      startTimeMs: this.startTimeMs,
      endTimeMs: Date.now(),
      metadata: this.options.metadata,
    };
    await this.options.onFlush(trace);
  }
}

export class ActiveSpan {
  readonly spanId: string;
  private readonly span: Span;
  private readonly spans: Map<string, Span>;

  constructor(span: Span, spans: Map<string, Span>) {
    this.spanId = span.spanId;
    this.span = span;
    this.spans = spans;
  }

  setAttribute(key: string, value: string | number | boolean | null): this {
    this.span.attributes[key] = value;
    return this;
  }

  /**
   * Attach this span to a specific subagent (WP15). Overrides any trace-
   * level or scope-based `agentId` for this span only. Idempotent; the
   * last call wins.
   */
  setAgent(agentId: string): this {
    this.span.agentId = agentId;
    return this;
  }

  addEvent(name: string, attributes?: Record<string, string | number | boolean | null>): this {
    this.span.events.push({ timeMs: Date.now(), name, attributes: attributes ?? {} });
    return this;
  }

  end(status: "ok" | "error" = "ok"): void {
    this.span.status = status;
    this.span.endTimeMs = Date.now();
    this.spans.set(this.spanId, this.span);
  }
}
