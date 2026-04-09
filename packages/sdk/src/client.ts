import type { Trace, Score, ScoreSource } from "@foxhound/types";
import { Tracer } from "./tracer.js";

export interface FoxhoundClientOptions {
  apiKey: string;
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export interface CreateScoreParams {
  traceId: string;
  spanId?: string;
  name: string;
  value?: number;
  label?: string;
  source?: ScoreSource;
  comment?: string;
}

/**
 * Namespaced API for creating and querying scores.
 * Access via `fox.scores.create(...)`.
 */
class ScoresNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  /** @internal */
  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  /**
   * Create a score attached to a trace (and optionally a span).
   */
  async create(params: CreateScoreParams): Promise<Score> {
    const body = {
      traceId: params.traceId,
      spanId: params.spanId,
      name: params.name,
      value: params.value,
      label: params.label,
      source: params.source ?? "sdk",
      comment: params.comment,
    };

    const response = await fetch(`${this.endpoint}/v1/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to create score: ${response.status} ${text || response.statusText}`);
    }

    return response.json() as Promise<Score>;
  }
}

export class FoxhoundClient {
  private readonly options: Required<FoxhoundClientOptions>;
  private readonly tracers: Map<string, Tracer> = new Map();

  /** Namespaced API for scores. */
  readonly scores: ScoresNamespace;

  constructor(options: FoxhoundClientOptions) {
    this.options = {
      flushIntervalMs: 5000,
      maxBatchSize: 100,
      ...options,
    };
    this.scores = new ScoresNamespace(this.options.endpoint, this.options.apiKey);
  }

  startTrace(params: {
    agentId: string;
    sessionId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Tracer {
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
      throw new Error(
        `Failed to send trace ${trace.id}: ${response.status} ${response.statusText}`,
      );
    }
  }
}
