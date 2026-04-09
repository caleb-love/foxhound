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
} from "./types.js";

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

  async createApiKey(name: string): Promise<ApiKeyCreatedResponse> {
    return this.post("/v1/api-keys", { name });
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
    method: "GET" | "POST" | "DELETE",
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
