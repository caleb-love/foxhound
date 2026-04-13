/**
 * OpenTelemetry SpanProcessor bridge for the Foxhound observability SDK (TypeScript).
 *
 * Bridges the OpenTelemetry JS `SpanProcessor` interface to Foxhound's native
 * trace model, enabling automatic instrumentation of any framework that emits
 * OpenTelemetry GenAI semantic convention spans.
 *
 * Supported frameworks (single import, zero framework code changes):
 *
 * **Mastra**:
 * ```ts
 * import { FoxhoundClient } from "@foxhound-ai/sdk";
 * import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";
 * import { NodeSDK } from "@opentelemetry/sdk-node";
 *
 * const fox = new FoxhoundClient({ apiKey: "fox_...", endpoint: "https://your-foxhound-instance.com" });
 * const processor = FoxhoundSpanProcessor.fromClient(fox, { agentId: "my-mastra-agent" });
 *
 * const sdk = new NodeSDK({ spanProcessor: processor });
 * sdk.start();
 *
 * // Run Mastra agents normally — spans are captured automatically
 * await processor.forceFlush();
 * ```
 *
 * **Generic OTel (any JS/TS framework)**:
 * ```ts
 * import { trace } from "@opentelemetry/api";
 * import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
 * import { FoxhoundClient } from "@foxhound-ai/sdk";
 * import { FoxhoundSpanProcessor } from "@foxhound-ai/sdk/integrations/opentelemetry";
 *
 * const fox = new FoxhoundClient({ apiKey: "fox_...", endpoint: "https://your-foxhound-instance.com" });
 * const processor = FoxhoundSpanProcessor.fromClient(fox, { agentId: "my-agent" });
 *
 * const provider = new NodeTracerProvider();
 * provider.addSpanProcessor(processor);
 * trace.setGlobalTracerProvider(provider);
 * ```
 *
 * Requires `@opentelemetry/api` as a peer dependency (>=1.4.0).
 *
 * GenAI semantic convention mapping
 * ------------------------------------
 * - `gen_ai.operation.name === "chat"`            → `"llm_call"`
 * - `gen_ai.operation.name === "text_completion"` → `"llm_call"`
 * - `gen_ai.operation.name === "embeddings"`      → `"tool_call"`
 * - span name starts with `"agent"`               → `"agent_step"`
 * - span name starts with `"tool"`                → `"tool_call"`
 * - all others                                    → `"workflow"`
 *
 * Attribute mapping
 * -----------------
 * - `gen_ai.request.model`       → `llm.model`
 * - `gen_ai.usage.input_tokens`  → `llm.prompt_tokens`
 * - `gen_ai.usage.output_tokens` → `llm.completion_tokens`
 * - `gen_ai.usage.total_tokens`  → `llm.total_tokens`
 * - `gen_ai.prompt`              → `agent.prompt` (truncated to 512 chars)
 */

import type { SpanKind } from "@foxhound/types";
import type { FoxhoundClient } from "../client.js";
import type { Tracer, ActiveSpan } from "../tracer.js";

// ---------------------------------------------------------------------------
// OTel interface shapes (structural typing — no runtime import of @opentelemetry/api)
// ---------------------------------------------------------------------------

/**
 * Minimal structural shape of an OTel SpanContext (read-only).
 * We only need the fields the bridge accesses.
 */
export interface OtelSpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  isValid?: boolean;
}

/**
 * Minimal structural shape of an OTel Status object.
 */
export interface OtelStatus {
  code: number; // 0 = UNSET, 1 = OK, 2 = ERROR
  message?: string;
}

/**
 * Minimal structural shape of an OTel ReadableSpan (duck-typed).
 * This is what `onEnd` receives from the OTel SDK.
 */
export interface OtelReadableSpan {
  name: string;
  spanContext(): OtelSpanContext;
  parentSpanId?: string;
  status: OtelStatus;
  attributes: Record<string, unknown>;
}

/**
 * Minimal structural shape of an OTel ReadWriteSpan (duck-typed).
 * This is what `onStart` receives.
 */
export interface OtelReadWriteSpan extends OtelReadableSpan {
  // Same shape — ReadWriteSpan is a superset, but we only need these fields.
}

/**
 * OTel SpanProcessor interface (structural).
 * Implemented by FoxhoundSpanProcessor so it can be registered with any
 * OTel TracerProvider without importing @opentelemetry/api at runtime.
 */
export interface SpanProcessor {
  onStart(span: OtelReadWriteSpan, parentContext: unknown): void;
  onEnd(span: OtelReadableSpan): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

// ---------------------------------------------------------------------------
// OTel status codes (mirrors opentelemetry/api StatusCode enum values)
// ---------------------------------------------------------------------------
const OTEL_STATUS_ERROR = 2;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FoxhoundSpanProcessorOptions {
  agentId: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Bridge implementation
// ---------------------------------------------------------------------------

/**
 * `FoxhoundSpanProcessor` implements the OpenTelemetry `SpanProcessor`
 * interface and maps GenAI semantic convention spans to Foxhound trace spans.
 *
 * Span-kind mapping:
 * | gen_ai.operation.name | Fox kind     |
 * |-----------------------|--------------|
 * | chat                  | llm_call     |
 * | text_completion       | llm_call     |
 * | embeddings            | tool_call    |
 * | agent / invoke        | agent_step   |
 * | tool / execute        | tool_call    |
 * | (missing / other)     | workflow     |
 *
 * Observability:
 * - Span mapping decisions logged at `console.debug` level.
 * - Errors in `onEnd` caught and logged via `console.error` — never throw.
 * - Malformed spans (no spanContext or traceId) logged as `console.warn` and skipped.
 * - Prompt content in `agent.prompt` truncated to 512 chars matching other integrations.
 */
export class FoxhoundSpanProcessor implements SpanProcessor {
  private readonly tracer: Tracer;
  /**
   * Map from OTel string spanId → Fox ActiveSpan (in-flight).
   * OTel JS SDK uses 16-char hex strings for spanId.
   */
  private readonly spanMap: Map<string, ActiveSpan> = new Map();

  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }

  // ------------------------------------------------------------------
  // Factory
  // ------------------------------------------------------------------

  /**
   * Create a processor from a {@link FoxhoundClient} instance.
   *
   * @param client  An initialised `FoxhoundClient`.
   * @param options Processor options including `agentId`.
   */
  static fromClient(
    client: FoxhoundClient,
    options: FoxhoundSpanProcessorOptions,
  ): FoxhoundSpanProcessor {
    const tracer = client.startTrace({
      agentId: options.agentId,
      sessionId: options.sessionId,
      metadata: options.metadata,
    });
    return new FoxhoundSpanProcessor(tracer);
  }

  // ------------------------------------------------------------------
  // Public accessors
  // ------------------------------------------------------------------

  get traceId(): string {
    return this.tracer.traceId;
  }

  // ------------------------------------------------------------------
  // SpanProcessor implementation
  // ------------------------------------------------------------------

  /**
   * Called when an OTel span starts.
   *
   * Creates a corresponding Fox span and stores the mapping keyed by the
   * OTel span's string `spanId`.
   */
  onStart(span: OtelReadWriteSpan, _parentContext: unknown): void {
    try {
      const ctx = span.spanContext();
      if (!ctx || !ctx.traceId) {
        console.warn(`FoxhoundSpanProcessor: span '${span.name}' has no traceId — skipping`);
        return;
      }

      const otelSpanId = ctx.spanId;
      const parentFoxId = this.resolveParent(span);
      const kind = this.semanticToFoxKind(span);

      console.debug(
        `FoxhoundSpanProcessor.onStart: span=${JSON.stringify(span.name)} kind=${kind} parentFoxId=${parentFoxId ?? null} otelId=${otelSpanId}`,
      );

      const foxSpan = this.tracer.startSpan({
        name: span.name || "span",
        kind,
        parentSpanId: parentFoxId ?? undefined,
      });
      this.spanMap.set(otelSpanId, foxSpan);
    } catch (err) {
      console.error(`FoxhoundSpanProcessor: error in onStart for span '${span.name}':`, err);
    }
  }

  /**
   * Called when an OTel span ends.
   *
   * Looks up the Fox span, applies GenAI attribute mappings, propagates
   * error status, and ends the Fox span.
   */
  onEnd(span: OtelReadableSpan): void {
    try {
      const ctx = span.spanContext();
      if (!ctx) return;

      const otelSpanId = ctx.spanId;
      const foxSpan = this.spanMap.get(otelSpanId);
      if (!foxSpan) return;
      this.spanMap.delete(otelSpanId);

      const attrs = this.extractAttributes(span);
      for (const [key, value] of Object.entries(attrs)) {
        foxSpan.setAttribute(key, value);
      }

      const status = otelStatusToFox(span.status);
      console.debug(
        `FoxhoundSpanProcessor.onEnd: span=${JSON.stringify(span.name)} status=${status}`,
      );
      foxSpan.end(status);
    } catch (err) {
      console.error(`FoxhoundSpanProcessor: error in onEnd for span '${span.name}':`, err);
    }
  }

  /**
   * Called when the SDK shuts down — flushes remaining spans.
   */
  async shutdown(): Promise<void> {
    await this.tracer.flush();
  }

  /**
   * Force-flush pending data.
   */
  async forceFlush(): Promise<void> {
    await this.tracer.flush();
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /**
   * Resolve the Fox spanId for the OTel span's parent, if known.
   *
   * OTel JS SDK exposes the parent span ID as `span.parentSpanId` (a hex string)
   * on ReadableSpan / ReadWriteSpan.
   */
  private resolveParent(span: OtelReadWriteSpan): string | null {
    const parentOtelId = span.parentSpanId;
    if (!parentOtelId) return null;
    const active = this.spanMap.get(parentOtelId);
    return active ? active.spanId : null;
  }

  /**
   * Map OTel GenAI semantic conventions to a Foxhound SpanKind.
   *
   * Priority:
   * 1. `gen_ai.operation.name` attribute → precise operation mapping
   * 2. Span name prefix heuristics (`agent`, `tool`)
   * 3. Default: `"workflow"`
   */
  private semanticToFoxKind(span: OtelReadWriteSpan): SpanKind {
    const attrs = span.attributes ?? {};
    const operation = String(attrs["gen_ai.operation.name"] ?? "").toLowerCase();
    const nameLower = (span.name ?? "").toLowerCase();

    if (operation === "chat" || operation === "text_completion") return "llm_call";
    if (operation === "embeddings") return "tool_call";
    if (operation === "agent" || operation === "invoke") return "agent_step";
    if (operation === "tool" || operation === "execute") return "tool_call";

    // Name-based heuristics when gen_ai.operation.name is absent
    if (nameLower.startsWith("agent")) return "agent_step";
    if (nameLower.startsWith("tool")) return "tool_call";

    return "workflow";
  }

  /**
   * Extract Foxhound attributes from OTel GenAI semantic convention attributes.
   *
   * Mapping:
   * - `gen_ai.request.model`       → `llm.model`
   * - `gen_ai.usage.input_tokens`  → `llm.prompt_tokens`
   * - `gen_ai.usage.output_tokens` → `llm.completion_tokens`
   * - `gen_ai.usage.total_tokens`  → `llm.total_tokens`
   * - `gen_ai.prompt`              → `agent.prompt` (truncated to 512 chars)
   */
  private extractAttributes(
    span: OtelReadableSpan,
  ): Record<string, string | number | boolean | null> {
    const raw = span.attributes ?? {};
    const result: Record<string, string | number | boolean | null> = {};

    const model = raw["gen_ai.request.model"];
    if (model != null) result["llm.model"] = String(model);

    const inputTokens = raw["gen_ai.usage.input_tokens"];
    if (inputTokens != null) result["llm.prompt_tokens"] = Number(inputTokens);

    const outputTokens = raw["gen_ai.usage.output_tokens"];
    if (outputTokens != null) result["llm.completion_tokens"] = Number(outputTokens);

    const totalTokens = raw["gen_ai.usage.total_tokens"];
    if (totalTokens != null) result["llm.total_tokens"] = Number(totalTokens);

    const prompt = raw["gen_ai.prompt"];
    if (prompt != null) result["agent.prompt"] = truncate(String(prompt), 512);

    return result;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function otelStatusToFox(status: OtelStatus | undefined): "ok" | "error" {
  if (!status) return "ok";
  return status.code === OTEL_STATUS_ERROR ? "error" : "ok";
}
