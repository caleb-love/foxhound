/**
 * HTTP client for the Foxhound API.
 * Wraps fetch with auth headers and error handling.
 */

export interface FoxhoundApiConfig {
  endpoint: string;
  apiKey: string;
}

export class FoxhoundApiClient {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(config: FoxhoundApiConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  async searchTraces(params: {
    agentId?: string;
    from?: number;
    to?: number;
    limit?: number;
    page?: number;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.agentId) query.set("agentId", params.agentId);
    if (params.from !== undefined) query.set("from", String(params.from));
    if (params.to !== undefined) query.set("to", String(params.to));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.page !== undefined) query.set("page", String(params.page));
    return this.get(`/v1/traces?${query.toString()}`);
  }

  async getTrace(traceId: string): Promise<unknown> {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}`);
  }

  async replaySpan(traceId: string, spanId: string): Promise<unknown> {
    return this.get(
      `/v1/traces/${encodeURIComponent(traceId)}/spans/${encodeURIComponent(spanId)}/replay`,
    );
  }

  async diffRuns(runA: string, runB: string): Promise<unknown> {
    const query = new URLSearchParams({ runA, runB });
    return this.get(`/v1/runs/diff?${query.toString()}`);
  }

  async getBillingUsage(): Promise<unknown> {
    return this.get("/v1/billing/usage");
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.endpoint}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Foxhound API ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
  }
}
