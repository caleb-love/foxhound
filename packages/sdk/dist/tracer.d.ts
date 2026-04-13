import type { Span, SpanKind, Trace } from "@foxhound/types";
interface TracerOptions {
    agentId: string;
    sessionId?: string;
    metadata: Record<string, string | number | boolean | null>;
    onFlush: (trace: Trace) => Promise<void>;
}
export declare class Tracer {
    readonly traceId: string;
    private readonly options;
    private readonly spans;
    private readonly startTimeMs;
    constructor(options: TracerOptions);
    startSpan(params: {
        name: string;
        kind: SpanKind;
        parentSpanId?: string;
        attributes?: Record<string, string | number | boolean | null>;
    }): ActiveSpan;
    /**
     * Attach prompt version info to this trace's metadata.
     * Called automatically when using a resolved prompt with this trace.
     */
    setPrompt(params: {
        name: string;
        version: number;
        label?: string;
    }): this;
    flush(): Promise<void>;
}
export declare class ActiveSpan {
    readonly spanId: string;
    private readonly span;
    private readonly spans;
    constructor(span: Span, spans: Map<string, Span>);
    setAttribute(key: string, value: string | number | boolean | null): this;
    addEvent(name: string, attributes?: Record<string, string | number | boolean | null>): this;
    end(status?: "ok" | "error"): void;
}
export {};
//# sourceMappingURL=tracer.d.ts.map