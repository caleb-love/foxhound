import { randomUUID } from "crypto";
import type { Span, SpanKind, Trace } from "@fox/types";

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
  }): ActiveSpan {
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
    };
    this.spans.set(span.spanId, span);
    return new ActiveSpan(span, this.spans);
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
