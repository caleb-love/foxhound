/**
 * Typed HTTP client for the Foxhound API.
 * Shared by the CLI and MCP server packages.
 */

import type { Trace } from "@foxhound/types";
import type {
  FoxhoundApiConfig,
  TraceListResponse,
  ReplayResponse,
  DiffResponse,
  AlertRule,
  AlertRuleListResponse,
  AlertEventType,
  AlertSeverity,
  ChannelKind,
  NotificationChannel,
  ChannelListResponse,
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
  LoginResponse,
  MeResponse,
  HealthResponse,
  UsageResponse,
  ScoreListResponse,
  TraceScoresResponse,
  EvaluatorListResponse,
  TriggerEvaluatorRunsResponse,
  AnnotationQueueListResponse,
  AnnotationQueueWithStats,
  AddAnnotationItemsResponse,
  SubmitAnnotationResponse,
  DatasetListResponse,
  DatasetWithCount,
  DatasetItemListResponse,
  FromTracesResponse,
  ExperimentListResponse,
  ExperimentWithRuns,
  CreateExperimentResponse,
  ExperimentComparisonResponse,
  AgentConfigResponse,
  AgentConfigListResponse,
  BaselineListResponse,
  RegressionReportResponse,
  PromptResponse,
  PromptListResponse,
  PromptVersionResponse,
  PromptVersionListResponse,
  ResolvedPromptResponse,
} from "./types.js";
import type {
  Score,
  Evaluator,
  EvaluatorRun,
  AnnotationQueueItem,
  ScoreSource,
  Dataset,
  DatasetItem,
  Experiment,
} from "@foxhound/types";

export * from "./types.js";

// ── Utilities ─────────────────────────────────────────────────────────────

/** Parse an ISO 8601 string or epoch-ms string into epoch milliseconds. */
export function toEpochMs(value: string): number {
  const num = Number(value);
  if (!isNaN(num)) return num;
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date.getTime();
}

// ── Client ────────────────────────────────────────────────────────────────

export class FoxhoundApiClient {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(config: FoxhoundApiConfig) {
    let endpoint = config.endpoint;
    while (endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);

    // Enforce HTTPS for non-localhost endpoints
    if (
      !endpoint.startsWith("https://") &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(endpoint)
    ) {
      throw new Error(
        "Non-localhost endpoints must use HTTPS. " +
          "Use https:// or connect to localhost for development.",
      );
    }

    this.endpoint = endpoint;
    this.apiKey = config.apiKey;
  }

  // ── Traces ──────────────────────────────────────────────────────────────

  async searchTraces(params: {
    agentId?: string;
    from?: number;
    to?: number;
    limit?: number;
    page?: number;
  }): Promise<TraceListResponse> {
    const query = new URLSearchParams();
    if (params.agentId !== undefined) query.set("agentId", params.agentId);
    if (params.from !== undefined) query.set("from", String(params.from));
    if (params.to !== undefined) query.set("to", String(params.to));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.page !== undefined) query.set("page", String(params.page));
    return this.get(`/v1/traces?${query.toString()}`);
  }

  async getTrace(traceId: string): Promise<Trace> {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}`);
  }

  async replaySpan(traceId: string, spanId: string): Promise<ReplayResponse> {
    return this.get(
      `/v1/traces/${encodeURIComponent(traceId)}/spans/${encodeURIComponent(spanId)}/replay`,
    );
  }

  async diffRuns(runA: string, runB: string): Promise<DiffResponse> {
    const query = new URLSearchParams({ runA, runB });
    return this.get(`/v1/runs/diff?${query.toString()}`);
  }

  // ── Alert Rules ─────────────────────────────────────────────────────────

  async listAlertRules(): Promise<AlertRuleListResponse> {
    return this.get("/v1/notifications/rules");
  }

  async createAlertRule(params: {
    eventType: AlertEventType;
    minSeverity: AlertSeverity;
    channelId: string;
  }): Promise<AlertRule> {
    return this.post("/v1/notifications/rules", params);
  }

  async deleteAlertRule(ruleId: string): Promise<{ success: boolean }> {
    return this.del(`/v1/notifications/rules/${encodeURIComponent(ruleId)}`);
  }

  // ── Notification Channels ─────────────────────────────────────────────

  async listChannels(): Promise<ChannelListResponse> {
    return this.get("/v1/notifications/channels");
  }

  async createChannel(params: {
    name: string;
    kind: ChannelKind;
    config: { webhookUrl: string; channel?: string; dashboardBaseUrl?: string };
  }): Promise<NotificationChannel> {
    return this.post("/v1/notifications/channels", params);
  }

  async testChannel(
    channelId: string,
    params?: {
      eventType?: AlertEventType;
      severity?: AlertSeverity;
    },
  ): Promise<{ ok: boolean }> {
    return this.post("/v1/notifications/test", {
      channelId,
      eventType: params?.eventType ?? "agent_failure",
      severity: params?.severity ?? "high",
    });
  }

  async deleteChannel(channelId: string): Promise<{ success: boolean }> {
    return this.del(`/v1/notifications/channels/${encodeURIComponent(channelId)}`);
  }

  // ── API Keys ──────────────────────────────────────────────────────────

  async listApiKeys(): Promise<ApiKeyListResponse> {
    return this.get("/v1/api-keys");
  }

  async createApiKey(
    name: string,
    options?: { expiresAt?: string },
  ): Promise<ApiKeyCreatedResponse> {
    const body: Record<string, unknown> = { name };
    if (options?.expiresAt) body.expiresAt = options.expiresAt;
    return this.post("/v1/api-keys", body);
  }

  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    return this.del(`/v1/api-keys/${encodeURIComponent(keyId)}`);
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.post("/v1/auth/login", { email, password });
  }

  async getMe(): Promise<MeResponse> {
    return this.get("/v1/auth/me");
  }

  // ── Health / Usage ────────────────────────────────────────────────────

  async getHealth(): Promise<HealthResponse> {
    return this.get("/health");
  }

  async getUsage(): Promise<UsageResponse> {
    return this.get("/v1/billing/usage");
  }

  // ── Billing ──────────────────────────────────────────────────────────────

  async createCheckout(params: {
    plan: import("./types.js").CheckoutPlan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<import("./types.js").CheckoutResponse> {
    return this.post("/v1/billing/checkout", params as unknown as Record<string, unknown>);
  }

  async createPortalSession(returnUrl: string): Promise<import("./types.js").PortalResponse> {
    return this.post("/v1/billing/portal", { returnUrl });
  }

  async getBillingStatus(): Promise<import("./types.js").BillingStatusResponse> {
    return this.get("/v1/billing/status");
  }

  // ── Scores ──────────────────────────────────────────────────────────

  async createScore(params: {
    traceId: string;
    spanId?: string;
    name: string;
    value?: number;
    label?: string;
    source: ScoreSource;
    comment?: string;
  }): Promise<Score> {
    return this.post("/v1/scores", params as unknown as Record<string, unknown>);
  }

  async queryScores(params?: {
    traceId?: string;
    name?: string;
    source?: string;
    minValue?: number;
    maxValue?: number;
    page?: number;
    limit?: number;
  }): Promise<ScoreListResponse> {
    const query = new URLSearchParams();
    if (params?.traceId !== undefined) query.set("traceId", params.traceId);
    if (params?.name !== undefined) query.set("name", params.name);
    if (params?.source !== undefined) query.set("source", params.source);
    if (params?.minValue !== undefined) query.set("minValue", String(params.minValue));
    if (params?.maxValue !== undefined) query.set("maxValue", String(params.maxValue));
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    return this.get(`/v1/scores?${query.toString()}`);
  }

  async getTraceScores(traceId: string): Promise<TraceScoresResponse> {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}/scores`);
  }

  async deleteScore(scoreId: string): Promise<void> {
    await this.del(`/v1/scores/${encodeURIComponent(scoreId)}`);
  }

  // ── Evaluators ─────────────────────────────────────────────────────

  async createEvaluator(params: {
    name: string;
    promptTemplate: string;
    model: string;
    scoringType: "numeric" | "categorical";
    labels?: string[];
  }): Promise<Evaluator> {
    return this.post("/v1/evaluators", params as unknown as Record<string, unknown>);
  }

  async listEvaluators(): Promise<EvaluatorListResponse> {
    return this.get("/v1/evaluators");
  }

  async getEvaluator(evaluatorId: string): Promise<Evaluator> {
    return this.get(`/v1/evaluators/${encodeURIComponent(evaluatorId)}`);
  }

  async deleteEvaluator(evaluatorId: string): Promise<void> {
    await this.del(`/v1/evaluators/${encodeURIComponent(evaluatorId)}`);
  }

  async triggerEvaluatorRuns(params: {
    evaluatorId: string;
    traceIds: string[];
  }): Promise<TriggerEvaluatorRunsResponse> {
    return this.post("/v1/evaluator-runs", params as unknown as Record<string, unknown>);
  }

  async getEvaluatorRun(runId: string): Promise<EvaluatorRun> {
    return this.get(`/v1/evaluator-runs/${encodeURIComponent(runId)}`);
  }

  // ── Annotation Queues ──────────────────────────────────────────────

  async createAnnotationQueue(params: {
    name: string;
    description?: string;
    scoreConfigs?: Array<{ name: string; type: "numeric" | "categorical"; labels?: string[] }>;
  }): Promise<import("@foxhound/types").AnnotationQueue> {
    return this.post("/v1/annotation-queues", params as unknown as Record<string, unknown>);
  }

  async listAnnotationQueues(): Promise<AnnotationQueueListResponse> {
    return this.get("/v1/annotation-queues");
  }

  async getAnnotationQueue(queueId: string): Promise<AnnotationQueueWithStats> {
    return this.get(`/v1/annotation-queues/${encodeURIComponent(queueId)}`);
  }

  async deleteAnnotationQueue(queueId: string): Promise<void> {
    await this.del(`/v1/annotation-queues/${encodeURIComponent(queueId)}`);
  }

  async addAnnotationItems(
    queueId: string,
    traceIds: string[],
  ): Promise<AddAnnotationItemsResponse> {
    return this.post(`/v1/annotation-queues/${encodeURIComponent(queueId)}/items`, { traceIds });
  }

  async claimAnnotationItem(queueId: string): Promise<AnnotationQueueItem | null> {
    const response = await fetch(
      `${this.endpoint}/v1/annotation-queues/${encodeURIComponent(queueId)}/claim`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      },
    );
    if (response.status === 204) return null;
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const text = raw.length > 500 ? raw.slice(0, 500) + "…" : raw;
      throw new Error(`Foxhound API ${response.status}: ${text || response.statusText}`);
    }
    return response.json() as Promise<AnnotationQueueItem>;
  }

  async submitAnnotationItem(
    itemId: string,
    scores: Array<{ name: string; value?: number; label?: string; comment?: string }>,
  ): Promise<SubmitAnnotationResponse> {
    return this.post(`/v1/annotation-queue-items/${encodeURIComponent(itemId)}/submit`, {
      scores,
    } as unknown as Record<string, unknown>);
  }

  async skipAnnotationItem(itemId: string): Promise<AnnotationQueueItem> {
    return this.post(`/v1/annotation-queue-items/${encodeURIComponent(itemId)}/skip`, {});
  }

  // ── Datasets ──────────────────────────────────────────────────────────

  async createDataset(params: { name: string; description?: string }): Promise<Dataset> {
    return this.post("/v1/datasets", params as unknown as Record<string, unknown>);
  }

  async listDatasets(): Promise<DatasetListResponse> {
    return this.get("/v1/datasets");
  }

  async getDataset(datasetId: string): Promise<DatasetWithCount> {
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async deleteDataset(datasetId: string): Promise<void> {
    await this.del(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async createDatasetItem(
    datasetId: string,
    params: {
      input: Record<string, unknown>;
      expectedOutput?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      sourceTraceId?: string;
    },
  ): Promise<DatasetItem> {
    return this.post(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items`,
      params as unknown as Record<string, unknown>,
    );
  }

  async listDatasetItems(
    datasetId: string,
    params?: { page?: number; limit?: number },
  ): Promise<DatasetItemListResponse> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}/items?${query.toString()}`);
  }

  async deleteDatasetItem(datasetId: string, itemId: string): Promise<void> {
    await this.del(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`,
    );
  }

  async createDatasetItemsFromTraces(
    datasetId: string,
    params: {
      scoreName: string;
      scoreOperator: "lt" | "gt" | "lte" | "gte";
      scoreThreshold: number;
      sinceDays?: number;
      limit?: number;
    },
  ): Promise<FromTracesResponse> {
    return this.post(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items/from-traces`,
      params as unknown as Record<string, unknown>,
    );
  }

  // ── Experiments ────────────────────────────────────────────────────────

  async createExperiment(params: {
    datasetId: string;
    name: string;
    config: Record<string, unknown>;
  }): Promise<CreateExperimentResponse> {
    return this.post("/v1/experiments", params as unknown as Record<string, unknown>);
  }

  async listExperiments(params?: { datasetId?: string }): Promise<ExperimentListResponse> {
    const query = new URLSearchParams();
    if (params?.datasetId !== undefined) query.set("datasetId", params.datasetId);
    return this.get(`/v1/experiments?${query.toString()}`);
  }

  async getExperiment(experimentId: string): Promise<ExperimentWithRuns> {
    return this.get(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.del(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async compareExperiments(experimentIds: string[]): Promise<ExperimentComparisonResponse> {
    const ids = experimentIds.join(",");
    return this.get(`/v1/experiment-comparisons?experiment_ids=${encodeURIComponent(ids)}`);
  }

  // ── Budgets ────────────────────────────────────────────────────────────

  async setBudget(
    agentId: string,
    params: { costBudgetUsd: number; costAlertThresholdPct?: number; budgetPeriod?: string },
  ): Promise<AgentConfigResponse> {
    return this.request(
      "PUT",
      `/v1/budgets/${encodeURIComponent(agentId)}`,
      params as unknown as Record<string, unknown>,
    );
  }

  async getBudget(agentId: string): Promise<AgentConfigResponse> {
    return this.get(`/v1/budgets/${encodeURIComponent(agentId)}`);
  }

  async listBudgets(params?: { page?: number; limit?: number }): Promise<AgentConfigListResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.get(`/v1/budgets?${qs}`);
  }

  async deleteBudget(agentId: string): Promise<void> {
    await this.del(`/v1/budgets/${encodeURIComponent(agentId)}`);
  }

  // ── SLAs ───────────────────────────────────────────────────────────────

  async setSla(
    agentId: string,
    params: {
      maxDurationMs?: number;
      minSuccessRate?: number;
      evaluationWindowMs?: number;
      minSampleSize?: number;
    },
  ): Promise<AgentConfigResponse> {
    return this.request(
      "PUT",
      `/v1/slas/${encodeURIComponent(agentId)}`,
      params as unknown as Record<string, unknown>,
    );
  }

  async getSla(agentId: string): Promise<AgentConfigResponse> {
    return this.get(`/v1/slas/${encodeURIComponent(agentId)}`);
  }

  async listSlas(params?: { page?: number; limit?: number }): Promise<AgentConfigListResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.get(`/v1/slas?${qs}`);
  }

  async deleteSla(agentId: string): Promise<void> {
    await this.del(`/v1/slas/${encodeURIComponent(agentId)}`);
  }

  // ── Regressions ────────────────────────────────────────────────────────

  async getRegression(agentId: string): Promise<RegressionReportResponse> {
    return this.get(`/v1/regressions/${encodeURIComponent(agentId)}`);
  }

  async compareVersions(
    agentId: string,
    versionA: string,
    versionB: string,
  ): Promise<RegressionReportResponse> {
    return this.post(`/v1/regressions/${encodeURIComponent(agentId)}/compare`, {
      versionA,
      versionB,
    });
  }

  async listBaselines(agentId: string): Promise<BaselineListResponse> {
    return this.get(`/v1/regressions/${encodeURIComponent(agentId)}/baselines`);
  }

  async deleteBaseline(agentId: string, version: string): Promise<void> {
    await this.del(
      `/v1/regressions/${encodeURIComponent(agentId)}/baselines?version=${encodeURIComponent(version)}`,
    );
  }

  // ── Prompts ────────────────────────────────────────────────────────────

  async listPrompts(params?: { page?: number; limit?: number }): Promise<PromptListResponse> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.get(`/v1/prompts${suffix}`);
  }

  async getPrompt(promptId: string): Promise<PromptResponse> {
    return this.get(`/v1/prompts/${encodeURIComponent(promptId)}`);
  }

  async createPrompt(name: string): Promise<PromptResponse> {
    return this.post("/v1/prompts", { name });
  }

  async deletePrompt(promptId: string): Promise<void> {
    await this.del(`/v1/prompts/${encodeURIComponent(promptId)}`);
  }

  async createPromptVersion(
    promptId: string,
    params: { content: string; model?: string; config?: Record<string, unknown> },
  ): Promise<PromptVersionResponse> {
    return this.post(
      `/v1/prompts/${encodeURIComponent(promptId)}/versions`,
      params as unknown as Record<string, unknown>,
    );
  }

  async listPromptVersions(promptId: string): Promise<PromptVersionListResponse> {
    return this.get(`/v1/prompts/${encodeURIComponent(promptId)}/versions`);
  }

  async setPromptLabel(
    promptId: string,
    params: { label: string; versionNumber: number },
  ): Promise<{ message: string }> {
    return this.post(
      `/v1/prompts/${encodeURIComponent(promptId)}/labels`,
      params as unknown as Record<string, unknown>,
    );
  }

  async deletePromptLabel(promptId: string, label: string): Promise<void> {
    await this.del(
      `/v1/prompts/${encodeURIComponent(promptId)}/labels/${encodeURIComponent(label)}`,
    );
  }

  async resolvePrompt(name: string, label?: string): Promise<ResolvedPromptResponse> {
    const query = new URLSearchParams({ name });
    if (label) query.set("label", label);
    return this.get(`/v1/prompts/resolve?${query.toString()}`);
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    return this.request("GET", path);
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request("POST", path, body);
  }

  private async del<T>(path: string): Promise<T> {
    return this.request("DELETE", path);
  }

  /**
   * NOTE: Response type T is asserted, not validated at runtime.
   * The API server is the source of truth. If runtime validation
   * is needed, add zod schemas per-endpoint.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.endpoint}${path}`, init);

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      // Truncate long error bodies (e.g. HTML error pages) to avoid leaking server internals
      const text = raw.length > 500 ? raw.slice(0, 500) + "…" : raw;
      throw new Error(`Foxhound API ${response.status}: ${text || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
