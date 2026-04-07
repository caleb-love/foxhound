import type { Trace } from "@fox/types";
import { Tracer } from "./tracer.js";

export interface FoxClientOptions {
  apiKey: string;
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export class FoxClient {
  private readonly options: Required<FoxClientOptions>;
  private readonly tracers: Map<string, Tracer> = new Map();

  constructor(options: FoxClientOptions) {
    this.options = {
      flushIntervalMs: 5000,
      maxBatchSize: 100,
      ...options,
    };
  }

  startTrace(params: { agentId: string; sessionId?: string; metadata?: Record<string, string | number | boolean | null> }): Tracer {
    const tracer = new Tracer({
      agentId: params.agentId,
      sessionId: params.sessionId,
      metadata: params.metadata ?? {},
      onFlush: (trace) => this.sendTrace(trace),
    });
    this.tracers.set(tracer.traceId, tracer);
    return tracer;
  }

  private async sendTrace(trace: Trace): Promise<void> {
    const response = await fetch(`${this.options.endpoint}/v1/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(trace),
    });

    if (!response.ok) {
      throw new Error(`Failed to send trace ${trace.id}: ${response.status} ${response.statusText}`);
    }
  }
}
