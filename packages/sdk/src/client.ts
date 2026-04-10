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

export interface SetBudgetParams {
  agentId: string;
  costBudgetUsd: number;
  costAlertThresholdPct?: number;
  budgetPeriod?: string;
}

export interface SetSLAParams {
  agentId: string;
  maxDurationMs?: number;
  minSuccessRate?: number;
  evaluationWindowMs?: number;
  minSampleSize?: number;
}

export interface CompareRegressionsParams {
  agentId: string;
  versionA: string;
  versionB: string;
}

export interface DeleteBaselineParams {
  agentId: string;
  version: string;
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

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
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
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to create score: ${response.status} ${text || response.statusText}`);
    }

    return response.json() as Promise<Score>;
  }
}

/**
 * Namespaced API for managing agent cost budgets.
 * Access via `fox.budgets.set(...)`.
 */
class BudgetsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  /** @internal */
  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Set or update the budget for an agent. */
  async set(params: SetBudgetParams): Promise<unknown> {
    const { agentId, ...body } = params;
    const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to set budget: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** Get the budget for a specific agent. */
  async get(agentId: string): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to get budget: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** List all budgets. */
  async list(): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/budgets`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to list budgets: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** Delete the budget for a specific agent. */
  async delete(agentId: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to delete budget: ${response.status} ${text || response.statusText}`);
    }
  }
}

/**
 * Namespaced API for managing agent SLAs.
 * Access via `fox.slas.set(...)`.
 */
class SLAsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  /** @internal */
  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Set or update the SLA for an agent. */
  async set(params: SetSLAParams): Promise<unknown> {
    const { agentId, ...body } = params;
    const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to set SLA: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** Get the SLA for a specific agent. */
  async get(agentId: string): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to get SLA: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** List all SLAs. */
  async list(): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/slas`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to list SLAs: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** Delete the SLA for a specific agent. */
  async delete(agentId: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to delete SLA: ${response.status} ${text || response.statusText}`);
    }
  }
}

/**
 * Namespaced API for regression detection.
 * Access via `fox.regressions.compare(...)`.
 */
class RegressionsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  /** @internal */
  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Compare two versions of an agent to detect regressions. */
  async compare(params: CompareRegressionsParams): Promise<unknown> {
    const { agentId, ...body } = params;
    const response = await fetch(`${this.endpoint}/v1/regressions/${agentId}/compare`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Failed to compare regressions: ${response.status} ${text || response.statusText}`,
      );
    }
    return response.json();
  }

  /** Get all baselines for a specific agent. */
  async baselines(agentId: string): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/v1/regressions/${agentId}/baselines`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to get baselines: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }

  /** Delete a specific baseline version for an agent. */
  async deleteBaseline(params: DeleteBaselineParams): Promise<void> {
    const { agentId, version } = params;
    const url = new URL(`${this.endpoint}/v1/regressions/${agentId}/baselines`);
    url.searchParams.set("version", version);
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Failed to delete baseline: ${response.status} ${text || response.statusText}`,
      );
    }
  }
}

export class FoxhoundClient {
  private readonly options: Required<FoxhoundClientOptions>;
  private readonly tracers: Map<string, Tracer> = new Map();

  /** Namespaced API for scores. */
  readonly scores: ScoresNamespace;

  /** Namespaced API for cost budgets. */
  readonly budgets: BudgetsNamespace;

  /** Namespaced API for SLAs. */
  readonly slas: SLAsNamespace;

  /** Namespaced API for regression detection. */
  readonly regressions: RegressionsNamespace;

  constructor(options: FoxhoundClientOptions) {
    this.options = {
      flushIntervalMs: 5000,
      maxBatchSize: 100,
      ...options,
    };
    this.scores = new ScoresNamespace(this.options.endpoint, this.options.apiKey);
    this.budgets = new BudgetsNamespace(this.options.endpoint, this.options.apiKey);
    this.slas = new SLAsNamespace(this.options.endpoint, this.options.apiKey);
    this.regressions = new RegressionsNamespace(this.options.endpoint, this.options.apiKey);
  }

  startTrace(params: {
    agentId: string;
    sessionId?: string;
    parentAgentId?: string;
    correlationId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Tracer {
    const tracer = new Tracer({
      agentId: params.agentId,
      sessionId: params.sessionId,
      metadata: {
        ...(params.metadata ?? {}),
        ...(params.parentAgentId ? { parentAgentId: params.parentAgentId } : {}),
        ...(params.correlationId ? { correlationId: params.correlationId } : {}),
      },
      onFlush: (trace) => this.sendTrace(trace),
    });
    this.tracers.set(tracer.traceId, tracer);
    return tracer;
  }

  /**
   * Returns HTTP headers for propagating trace context to downstream agents.
   * Pass these headers when calling other Foxhound-instrumented services.
   */
  getPropagationHeaders(params: {
    correlationId?: string;
    parentAgentId?: string;
  }): Record<string, string> {
    const headers: Record<string, string> = {};
    if (params.correlationId) {
      headers["X-Foxhound-Correlation-Id"] = params.correlationId;
    }
    if (params.parentAgentId) {
      headers["X-Foxhound-Parent-Agent-Id"] = params.parentAgentId;
    }
    return headers;
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
