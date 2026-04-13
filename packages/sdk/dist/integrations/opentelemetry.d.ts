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
import type { FoxhoundClient } from "../client.js";
import type { Tracer } from "../tracer.js";
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
    code: number;
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
export interface FoxhoundSpanProcessorOptions {
    agentId: string;
    sessionId?: string;
    metadata?: Record<string, string | number | boolean | null>;
}
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
export declare class FoxhoundSpanProcessor implements SpanProcessor {
    private readonly tracer;
    /**
     * Map from OTel string spanId → Fox ActiveSpan (in-flight).
     * OTel JS SDK uses 16-char hex strings for spanId.
     */
    private readonly spanMap;
    constructor(tracer: Tracer);
    /**
     * Create a processor from a {@link FoxhoundClient} instance.
     *
     * @param client  An initialised `FoxhoundClient`.
     * @param options Processor options including `agentId`.
     */
    static fromClient(client: FoxhoundClient, options: FoxhoundSpanProcessorOptions): FoxhoundSpanProcessor;
    get traceId(): string;
    /**
     * Called when an OTel span starts.
     *
     * Creates a corresponding Fox span and stores the mapping keyed by the
     * OTel span's string `spanId`.
     */
    onStart(span: OtelReadWriteSpan, _parentContext: unknown): void;
    /**
     * Called when an OTel span ends.
     *
     * Looks up the Fox span, applies GenAI attribute mappings, propagates
     * error status, and ends the Fox span.
     */
    onEnd(span: OtelReadableSpan): void;
    /**
     * Called when the SDK shuts down — flushes remaining spans.
     */
    shutdown(): Promise<void>;
    /**
     * Force-flush pending data.
     */
    forceFlush(): Promise<void>;
    /**
     * Resolve the Fox spanId for the OTel span's parent, if known.
     *
     * OTel JS SDK exposes the parent span ID as `span.parentSpanId` (a hex string)
     * on ReadableSpan / ReadWriteSpan.
     */
    private resolveParent;
    /**
     * Map OTel GenAI semantic conventions to a Foxhound SpanKind.
     *
     * Priority:
     * 1. `gen_ai.operation.name` attribute → precise operation mapping
     * 2. Span name prefix heuristics (`agent`, `tool`)
     * 3. Default: `"workflow"`
     */
    private semanticToFoxKind;
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
    private extractAttributes;
}
//# sourceMappingURL=opentelemetry.d.ts.map