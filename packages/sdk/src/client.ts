import type { Trace, Score, ScoreSource } from "@foxhound/types";
import { Tracer } from "./tracer.js";
import {
  createTransport,
  type SpanTransport,
  type WireFormat,
} from "./transport/index.js";
import { BatchSpanProcessor } from "./transport/batch-processor.js";
import type { CompressionKind } from "./transport/compression.js";
import type { DropRecord } from "./transport/size-cap.js";
import type { BackpressurePolicy } from "./transport/batch-processor.js";

export interface BudgetExceededInfo {
  agentId: string;
  currentCost: number;
  budgetLimit: number;
}

export interface FoxhoundClientOptions {
  apiKey: string;
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  onBudgetExceeded?: (info: BudgetExceededInfo) => void;
  /**
   * Wire format for trace ingest. Defaults to `"protobuf"` per RFC-004.
   * `"json"` is retained as a fallback during the transition window.
   */
  wireFormat?: WireFormat;
  /**
   * Optional org ID hint embedded in the Protobuf batch envelope. The
   * server still authenticates via the API key; this is a routing aid for
   * downstream queue consumers (WP08).
   */
  orgId?: string;
  /** Override the fetch implementation (primarily for testing). */
  fetchImpl?: typeof fetch;
  /**
   * WP05 compression algorithm. Default `"gzip"`. `"none"` disables
   * compression (useful for debugging or when the transport sits behind
   * a load balancer that already compresses). `"lz4"` is reserved and
   * falls back to `"none"` without the optional `lz4-napi` peer.
   */
  compression?: CompressionKind;
  /**
   * WP05 drop callback. Fires for each span whose payload exceeded
   * `MAX_SPAN_PAYLOAD_BYTES` and was trimmed pre-send. When omitted,
   * the SDK emits a single-line `console.warn` per drop.
   */
  onDrop?: (record: DropRecord) => void;

  // ── WP06 BatchSpanProcessor options ──────────────────────────────────────

  /**
   * Maximum number of traces held in the in-memory export queue before
   * the backpressure policy kicks in. Default: 2048. Set to `0` to
   * disable the batch processor and revert to the pre-WP06 inline-export
   * behaviour (useful for tests that need synchronous delivery).
   */
  maxQueueSize?: number;

  /**
   * Maximum traces exported per transport round-trip. Matches Pendo's
   * OTel default of 512. Default: 512.
   */
  maxExportBatchSize?: number;

  /**
   * How often the batch processor's pump fires, in milliseconds.
   * Matches Pendo's OTel default of 2000 ms. Default: 2000.
   */
  exportScheduleDelayMs?: number;

  /**
   * What to do when the export queue is full. Default: `"drop-oldest"`
   * (keeps the most recent telemetry). Use `"block"` in development
   * for lossless export; use `"drop-newest"` when early traces are
   * the forensic ground truth. See RFC-006.
   */
  backpressurePolicy?: BackpressurePolicy;

  /**
   * Callback fired when a trace is discarded due to backpressure.
   * Defaults to a single-line `console.warn`.
   */
  onQueueDrop?: (trace: Trace, reason: "queue-full") => void;
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

/**
 * Namespaced API for datasets (golden test sets).
 * Access via `fox.datasets.create(...)`.
 */
class DatasetsNamespace {
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.endpoint}${path}`, {
      method,
      headers: this.headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Datasets API error: ${response.status} ${text || response.statusText}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async create(params: { name: string; description?: string }): Promise<unknown> {
    return this.request("POST", "/v1/datasets", params);
  }

  async list(): Promise<unknown> {
    return this.request("GET", "/v1/datasets");
  }

  async get(datasetId: string): Promise<unknown> {
    return this.request("GET", `/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async delete(datasetId: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async addItems(
    datasetId: string,
    items: Array<{
      input: Record<string, unknown>;
      expectedOutput?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      sourceTraceId?: string;
    }>,
  ): Promise<unknown[]> {
    const results = await Promise.all(
      items.map((item) =>
        this.request("POST", `/v1/datasets/${encodeURIComponent(datasetId)}/items`, item),
      ),
    );
    return results;
  }

  async fromTraces(
    datasetId: string,
    params: { traceIds: string[]; includeOutput?: boolean },
  ): Promise<unknown> {
    return this.request(
      "POST",
      `/v1/datasets/${encodeURIComponent(datasetId)}/items/from-traces`,
      params,
    );
  }
}

/**
 * Namespaced API for experiments (dataset evaluations).
 * Access via `fox.experiments.create(...)`.
 */
class ExperimentsNamespace {
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.endpoint}${path}`, {
      method,
      headers: this.headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Experiments API error: ${response.status} ${text || response.statusText}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async create(params: {
    datasetId: string;
    name: string;
    config?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("POST", "/v1/experiments", params);
  }

  async list(params?: { datasetId?: string }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params?.datasetId) query.set("datasetId", params.datasetId);
    return this.request("GET", `/v1/experiments?${query.toString()}`);
  }

  async get(experimentId: string): Promise<unknown> {
    return this.request("GET", `/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async delete(experimentId: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async compare(experimentIds: string[]): Promise<unknown> {
    const ids = experimentIds.join(",");
    return this.request(
      "GET",
      `/v1/experiment-comparisons?experiment_ids=${encodeURIComponent(ids)}`,
    );
  }
}

export interface PromptGetParams {
  name: string;
  label?: string;
}

export interface ResolvedPrompt {
  name: string;
  label: string;
  version: number;
  content: string;
  model: string | null;
  config: Record<string, unknown>;
}

interface PromptCacheEntry {
  prompt: ResolvedPrompt;
  expiresAt: number;
}

/**
 * Namespaced API for prompt management.
 * Access via `fox.prompts.get(...)`.
 */
class PromptsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly cacheTtlMs: number;
  private readonly cache: Map<string, PromptCacheEntry> = new Map();

  /** @internal */
  constructor(endpoint: string, apiKey: string, cacheTtlMs = 300_000) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.cacheTtlMs = cacheTtlMs;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private cacheKey(name: string, label: string): string {
    return `${name}::${label}`;
  }

  /**
   * Resolve a prompt by name and label. Results are cached client-side (5min TTL by default).
   *
   * Usage:
   *   const prompt = await fox.prompts.get({ name: "support-agent", label: "production" });
   *   console.log(prompt.content); // The prompt template text
   */
  async get(params: PromptGetParams): Promise<ResolvedPrompt> {
    const label = params.label ?? "production";
    const key = this.cacheKey(params.name, label);

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.prompt;
    }

    const url = new URL(`${this.endpoint}/v1/prompts/resolve`);
    url.searchParams.set("name", params.name);
    url.searchParams.set("label", label);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Failed to resolve prompt: ${response.status} ${text || response.statusText}`,
      );
    }

    const prompt = (await response.json()) as ResolvedPrompt;
    this.cache.set(key, { prompt, expiresAt: Date.now() + this.cacheTtlMs });
    return prompt;
  }

  /** Invalidate the client-side cache for a specific prompt+label or all prompts. */
  invalidate(params?: { name: string; label?: string }): void {
    if (!params) {
      this.cache.clear();
      return;
    }
    const label = params.label ?? "production";
    this.cache.delete(this.cacheKey(params.name, label));
  }
}

export class FoxhoundClient {
  private readonly options: Required<
    Pick<FoxhoundClientOptions, "apiKey" | "endpoint" | "flushIntervalMs" | "maxBatchSize">
  > &
    Pick<
      FoxhoundClientOptions,
      | "onBudgetExceeded" | "wireFormat" | "orgId" | "fetchImpl"
      | "compression" | "onDrop"
      | "maxQueueSize" | "maxExportBatchSize" | "exportScheduleDelayMs"
      | "backpressurePolicy" | "onQueueDrop"
    >;
  private readonly tracers: Map<string, Tracer> = new Map();
  /**
   * WP06: lazy-initialised BatchSpanProcessor. `undefined` when
   * `maxQueueSize === 0` (opt-out, synchronous export preserved).
   */
  private _bsp: BatchSpanProcessor | undefined;

  /** Namespaced API for scores. */
  readonly scores: ScoresNamespace;

  /** Namespaced API for cost budgets. */
  readonly budgets: BudgetsNamespace;

  /** Namespaced API for SLAs. */
  readonly slas: SLAsNamespace;

  /** Namespaced API for regression detection. */
  readonly regressions: RegressionsNamespace;

  /** Namespaced API for datasets (golden test sets). */
  readonly datasets: DatasetsNamespace;

  /** Namespaced API for experiments (dataset evaluations). */
  readonly experiments: ExperimentsNamespace;

  /** Namespaced API for prompt management. */
  readonly prompts: PromptsNamespace;

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
    this.datasets = new DatasetsNamespace(this.options.endpoint, this.options.apiKey);
    this.experiments = new ExperimentsNamespace(this.options.endpoint, this.options.apiKey);
    this.prompts = new PromptsNamespace(this.options.endpoint, this.options.apiKey);
    // WP06: initialise the BSP unless the caller explicitly opts out
    // via `maxQueueSize: 0`. The BSP uses the same lazy transport getter.
    if ((this.options.maxQueueSize ?? 2048) > 0) {
      // Adapter: the BSP calls `transport.send(trace)` expecting a SpanTransport
      // interface. We wrap `directSend` so it satisfies the shape without
      // exposing the budget-header check result to the BSP (it doesn't need it).
      const bspTransport: SpanTransport = {
        wireFormat: "protobuf",
        send: async (t) => {
          await this.directSend(t);
          // Return a stub SendResult; the BSP only cares about resolution/rejection.
          return { status: 202, wireFormat: "protobuf" as const, payloadBytes: 0, headers: new Headers() };
        },
        close: async () => {},
      };
      this._bsp = new BatchSpanProcessor({
        transport: bspTransport,
        ...(this.options.maxQueueSize !== undefined ? { maxQueueSize: this.options.maxQueueSize } : {}),
        ...(this.options.maxExportBatchSize !== undefined ? { maxExportBatchSize: this.options.maxExportBatchSize } : {}),
        ...(this.options.exportScheduleDelayMs !== undefined ? { scheduleDelayMs: this.options.exportScheduleDelayMs } : {}),
        ...(this.options.backpressurePolicy !== undefined ? { backpressurePolicy: this.options.backpressurePolicy } : {}),
        ...(this.options.onQueueDrop !== undefined ? { onDrop: this.options.onQueueDrop } : {}),
      });
    }
  }

  /**
   * WP06: flush all queued traces and shut down the batch processor.
   *
   * Call this before process exit to avoid losing in-flight traces:
   *
   *   process.on("SIGTERM", () => fox.shutdown().then(() => process.exit(0)));
   *
   * Returns `true` if every pending trace was exported within `timeoutMs`
   * (default 5 s); `false` if the timeout was reached with items still
   * pending.
   */
  async shutdown(timeoutMs = 5000): Promise<boolean> {
    if (this._bsp) return this._bsp.shutdown(timeoutMs);
    await this.transport.close().catch(() => {});
    return true;
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

  private _transport: SpanTransport | undefined;

  private get transport(): SpanTransport {
    if (!this._transport) {
      this._transport = createTransport({
        endpoint: this.options.endpoint,
        apiKey: this.options.apiKey,
        wireFormat: this.options.wireFormat ?? "protobuf",
        ...(this.options.orgId !== undefined ? { orgId: this.options.orgId } : {}),
        ...(this.options.fetchImpl !== undefined ? { fetchImpl: this.options.fetchImpl } : {}),
        ...(this.options.compression !== undefined ? { compression: this.options.compression } : {}),
        ...(this.options.onDrop !== undefined ? { onDrop: this.options.onDrop } : {}),
      });
    }
    return this._transport;
  }

  /**
   * WP06: route via the BSP when available; fall through to direct
   * export when `maxQueueSize: 0` was set (test / sync mode).
   */
  private async sendTrace(trace: Trace): Promise<void> {
    if (this._bsp) {
      // Non-blocking enqueue. The BSP pump calls `directSend()` later.
      this._bsp.enqueue(trace);
      return;
    }
    await this.directSend(trace);
  }

  /**
   * The synchronous transport call that the BSP's background pump uses.
   * Budget headers are checked here so the callback fires regardless of
   * whether the BSP is in use.
   */
  private async directSend(trace: Trace): Promise<void> {
    const result = await this.transport.send(trace);
    this.checkBudgetHeaders({ headers: result.headers } as unknown as Response);
  }

  private checkBudgetHeaders(response: Response): void {
    if (!this.options.onBudgetExceeded) {
      return;
    }

    const budgetStatus = response.headers?.get("X-Foxhound-Budget-Status");
    if (budgetStatus !== "exceeded") {
      return;
    }

    this.options.onBudgetExceeded({
      agentId: response.headers.get("X-Foxhound-Budget-Agent-Id") ?? "",
      currentCost: parseFloat(response.headers.get("X-Foxhound-Budget-Current-Cost") ?? "0"),
      budgetLimit: parseFloat(response.headers.get("X-Foxhound-Budget-Limit") ?? "0"),
    });
  }
}
