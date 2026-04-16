import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FoxhoundApiClient, toEpochMs } from "./index.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

const BASE_URL = "https://api.foxhound.caleb-love.com";
const API_KEY = "fox_test_key_abc123";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

function makeClient(
  overrides?: Partial<{ endpoint: string; apiKey: string; maxRetries: number }>,
): FoxhoundApiClient {
  return new FoxhoundApiClient({
    endpoint: overrides?.endpoint ?? BASE_URL,
    apiKey: overrides?.apiKey ?? API_KEY,
    maxRetries: overrides?.maxRetries ?? 0,
  });
}

function mockOk(body: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, statusText: string, body?: string): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body ?? statusText),
  });
}

function mockNetworkError(message: string): void {
  mockFetch.mockRejectedValueOnce(new TypeError(message));
}

function lastCallUrl(): string {
  const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
  return url;
}

function lastCallOpts(): RequestInit {
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  return opts;
}

function lastCallHeaders(): Record<string, string> {
  return lastCallOpts().headers as Record<string, string>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("toEpochMs utility", () => {
  it("returns numeric strings as numbers", () => {
    expect(toEpochMs("1712793600000")).toBe(1712793600000);
  });

  it("parses ISO 8601 date strings into epoch ms", () => {
    const result = toEpochMs("2024-04-11T00:00:00.000Z");
    expect(result).toBe(new Date("2024-04-11T00:00:00.000Z").getTime());
  });

  it("throws on invalid date strings", () => {
    expect(() => toEpochMs("not-a-date")).toThrow("Invalid date");
  });
});

describe("FoxhoundApiClient", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Constructor & Auth ────────────────────────────────────────────────────

  describe("constructor", () => {
    it("strips trailing slashes from endpoint", async () => {
      const client = makeClient({ endpoint: "https://api.foxhound.caleb-love.com///" });
      mockOk({ data: [] });

      await client.searchTraces({});

      expect(lastCallUrl()).toMatch(/^https:\/\/api\.foxhound\.caleb-love\.com\/v1\/traces/);
      expect(lastCallUrl()).not.toMatch(/\/\/v1/);
    });

    it("allows localhost HTTP endpoints", () => {
      expect(() => makeClient({ endpoint: "http://localhost:3000" })).not.toThrow();
      expect(() => makeClient({ endpoint: "http://127.0.0.1:3000" })).not.toThrow();
    });

    it("rejects non-localhost HTTP endpoints", () => {
      expect(() => makeClient({ endpoint: "http://api.foxhound.caleb-love.com" })).toThrow(
        "Non-localhost endpoints must use HTTPS",
      );
    });

    it("accepts HTTPS endpoints", () => {
      expect(() => makeClient({ endpoint: "https://api.foxhound.caleb-love.com" })).not.toThrow();
    });
  });

  describe("auth header injection", () => {
    it("sends Bearer token from apiKey on every request", async () => {
      const client = makeClient({ apiKey: "fox_my_secret" });
      mockOk({});

      await client.getHealth();

      expect(lastCallHeaders()).toMatchObject({
        Authorization: "Bearer fox_my_secret",
        Accept: "application/json",
      });
    });

    it("includes Content-Type header on POST requests", async () => {
      const client = makeClient();
      mockOk({ id: "rule-1" });

      await client.createAlertRule({
        eventType: "agent_failure",
        minSeverity: "high",
        channelId: "ch-1",
      });

      expect(lastCallHeaders()["Content-Type"]).toBe("application/json");
    });

    it("does not include Content-Type header on GET requests", async () => {
      const client = makeClient();
      mockOk({ status: "ok", version: "1.0.0" });

      await client.getHealth();

      expect(lastCallHeaders()["Content-Type"]).toBeUndefined();
    });
  });

  // ── HTTP Methods ──────────────────────────────────────────────────────────

  describe("HTTP methods", () => {
    it("uses GET for read operations", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.listEvaluators();

      expect(lastCallOpts().method).toBe("GET");
    });

    it("uses POST for create operations", async () => {
      const client = makeClient();
      mockOk({ id: "ds-1", name: "Test" });

      await client.createDataset({ name: "Test" });

      expect(lastCallOpts().method).toBe("POST");
    });

    it("uses DELETE for supported delete operations", async () => {
      const client = makeClient();
      mockOk({ success: true });

      await client.deleteScore("score-1");

      expect(lastCallOpts().method).toBe("DELETE");
    });

    it("uses PUT for setBudget", async () => {
      const client = makeClient();
      mockOk({ id: "cfg-1" });

      await client.setBudget("agent-1", { costBudgetUsd: 100 });

      expect(lastCallOpts().method).toBe("PUT");
    });

    it("sends JSON body on POST requests", async () => {
      const client = makeClient();
      mockOk({ token: "jwt-abc" });

      await client.login("user@test.com", "password123");

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ email: "user@test.com", password: "password123" });
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws on 404 responses", async () => {
      const client = makeClient();
      mockError(404, "Not Found");

      await expect(client.getTrace("missing")).rejects.toThrow("Foxhound API 404");
    });

    it("throws on 401 unauthorized", async () => {
      const client = makeClient();
      mockError(401, "Unauthorized", "Invalid API key");

      await expect(client.getMe()).rejects.toThrow("Foxhound API 401: Invalid API key");
    });

    it("throws on 403 forbidden", async () => {
      const client = makeClient();
      mockError(403, "Forbidden", "Access denied");

      await expect(client.listApiKeys()).rejects.toThrow("Foxhound API 403: Access denied");
    });

    it("throws on 500 server errors", async () => {
      const client = makeClient();
      mockError(500, "Internal Server Error", "Something broke");

      await expect(client.getHealth()).rejects.toThrow("Foxhound API 500: Something broke");
    });

    it("throws on 429 rate limit", async () => {
      const client = makeClient();
      mockError(429, "Too Many Requests", "Rate limit exceeded");

      await expect(client.listDatasets()).rejects.toThrow("Foxhound API 429: Rate limit exceeded");
    });

    it("truncates error bodies longer than 500 characters", async () => {
      const client = makeClient();
      const longBody = "x".repeat(600);
      mockError(500, "Internal Server Error", longBody);

      await expect(client.getHealth()).rejects.toThrow(/^Foxhound API 500: x{500}…$/);
    });

    it("falls back to statusText when body is empty", async () => {
      const client = makeClient();
      mockError(502, "Bad Gateway", "");

      await expect(client.getHealth()).rejects.toThrow("Foxhound API 502: Bad Gateway");
    });

    it("propagates network errors", async () => {
      const client = makeClient();
      mockNetworkError("Failed to fetch");

      await expect(client.getHealth()).rejects.toThrow("Failed to fetch");
    });
  });

  // ── URL Construction ──────────────────────────────────────────────────────

  describe("URL construction", () => {
    it("constructs baseUrl + path correctly", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.listEvaluators();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluators`);
    });

    it("encodes path parameters", async () => {
      const client = makeClient();
      mockOk({ id: "trace with spaces" });

      await client.getTrace("trace with spaces");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces/trace%20with%20spaces`);
    });

    it("encodes special characters in IDs", async () => {
      const client = makeClient();
      mockOk({});

      await client.getEvaluator("eval/slash+plus");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluators/eval%2Fslash%2Bplus`);
    });
  });

  // ── Traces ────────────────────────────────────────────────────────────────

  describe("traces", () => {
    it("searchTraces sends agentId and limit as query params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 10, count: 0 } });

      await client.searchTraces({ agentId: "my-agent", limit: 10 });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces?agentId=my-agent&limit=10`);
    });

    it("searchTraces includes time range params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

      await client.searchTraces({ from: 1000, to: 2000 });

      expect(lastCallUrl()).toContain("from=1000");
      expect(lastCallUrl()).toContain("to=2000");
    });

    it("searchTraces forwards page param", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 3, limit: 20, count: 0 } });

      await client.searchTraces({ page: 3 });

      expect(lastCallUrl()).toContain("page=3");
    });

    it("searchTraces omits undefined params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

      await client.searchTraces({});

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces?`);
    });

    it("getTrace fetches correct URL", async () => {
      const client = makeClient();
      mockOk({ id: "trace-123", spans: [] });

      await client.getTrace("trace-123");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces/trace-123`);
    });

    it("replaySpan constructs nested URL", async () => {
      const client = makeClient();
      mockOk({ context: {} });

      await client.replaySpan("trace-1", "span-2");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces/trace-1/spans/span-2/replay`);
    });

    it("diffRuns sends runA and runB as query params", async () => {
      const client = makeClient();
      mockOk({ diff: {} });

      await client.diffRuns("run-a", "run-b");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/runs/diff?runA=run-a&runB=run-b`);
    });
  });

  // ── Scores ────────────────────────────────────────────────────────────────

  describe("scores", () => {
    it("createScore sends POST with score body", async () => {
      const client = makeClient();
      mockOk({ id: "score-1" });

      await client.createScore({
        traceId: "trace-1",
        name: "accuracy",
        value: 0.95,
        source: "llm_judge",
      });

      expect(lastCallOpts().method).toBe("POST");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/scores`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toMatchObject({
        traceId: "trace-1",
        name: "accuracy",
        value: 0.95,
        source: "llm_judge",
      });
    });

    it("queryScores forwards filter params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

      await client.queryScores({
        traceId: "trace-1",
        name: "accuracy",
        source: "llm_judge",
        minValue: 0.5,
        maxValue: 1.0,
        page: 2,
        limit: 50,
      });

      const url = lastCallUrl();
      expect(url).toContain("traceId=trace-1");
      expect(url).toContain("name=accuracy");
      expect(url).toContain("source=llm_judge");
      expect(url).toContain("minValue=0.5");
      expect(url).toContain("maxValue=1");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=50");
    });

    it("queryScores works with no params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

      await client.queryScores();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/scores?`);
    });

    it("getTraceScores uses trace-scoped URL", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.getTraceScores("trace-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/traces/trace-1/scores`);
    });

    it("deleteScore sends DELETE", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteScore("score-1");

      expect(lastCallOpts().method).toBe("DELETE");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/scores/score-1`);
    });
  });

  // ── Evaluators ────────────────────────────────────────────────────────────

  describe("evaluators", () => {
    it("createEvaluator sends full config", async () => {
      const client = makeClient();
      mockOk({ id: "eval-1" });

      await client.createEvaluator({
        name: "Quality Check",
        promptTemplate: "Rate this output: {{output}}",
        model: "claude-sonnet-4-20250514",
        scoringType: "numeric",
      });

      expect(lastCallOpts().method).toBe("POST");
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.name).toBe("Quality Check");
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.scoringType).toBe("numeric");
    });

    it("listEvaluators fetches list endpoint", async () => {
      const client = makeClient();
      mockOk({ data: [{ id: "eval-1" }, { id: "eval-2" }] });

      const result = await client.listEvaluators();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluators`);
      expect(result.data).toHaveLength(2);
    });

    it("triggerEvaluatorRuns sends evaluatorId and traceIds", async () => {
      const client = makeClient();
      mockOk({ message: "queued", runs: [] });

      await client.triggerEvaluatorRuns({
        evaluatorId: "eval-1",
        traceIds: ["trace-1", "trace-2"],
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluator-runs`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.evaluatorId).toBe("eval-1");
      expect(body.traceIds).toEqual(["trace-1", "trace-2"]);
    });

    it("getEvaluatorRun fetches by runId", async () => {
      const client = makeClient();
      mockOk({ id: "run-1", status: "completed" });

      await client.getEvaluatorRun("run-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluator-runs/run-1`);
    });

    it("deleteEvaluator sends DELETE", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteEvaluator("eval-1");

      expect(lastCallOpts().method).toBe("DELETE");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/evaluators/eval-1`);
    });
  });

  // ── Datasets ──────────────────────────────────────────────────────────────

  describe("datasets", () => {
    it("createDataset sends name and description", async () => {
      const client = makeClient();
      mockOk({ id: "ds-1", name: "My Dataset" });

      await client.createDataset({ name: "My Dataset", description: "Test dataset" });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ name: "My Dataset", description: "Test dataset" });
    });

    it("listDatasets fetches all datasets", async () => {
      const client = makeClient();
      mockOk({ data: [{ id: "ds-1" }] });

      const result = await client.listDatasets();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets`);
      expect(result.data).toHaveLength(1);
    });

    it("getDataset includes itemCount", async () => {
      const client = makeClient();
      mockOk({ id: "ds-1", name: "Test", itemCount: 42 });

      const result = await client.getDataset("ds-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets/ds-1`);
      expect(result.itemCount).toBe(42);
    });

    it("listDatasetItems forwards pagination params", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 2, limit: 10, count: 0 } });

      await client.listDatasetItems("ds-1", { page: 2, limit: 10 });

      const url = lastCallUrl();
      expect(url).toContain("/v1/datasets/ds-1/items");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("createDatasetItem posts to dataset-scoped items endpoint", async () => {
      const client = makeClient();
      mockOk({ id: "item-1" });

      await client.createDatasetItem("ds-1", {
        input: { question: "What is AI?" },
        expectedOutput: { answer: "Artificial Intelligence" },
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets/ds-1/items`);
      expect(lastCallOpts().method).toBe("POST");
    });

    it("deleteDatasetItem constructs nested URL", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteDatasetItem("ds-1", "item-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets/ds-1/items/item-1`);
      expect(lastCallOpts().method).toBe("DELETE");
    });

    it("createDatasetItemsFromTraces posts filter params", async () => {
      const client = makeClient();
      mockOk({ added: 5, items: [] });

      await client.createDatasetItemsFromTraces("ds-1", {
        scoreName: "accuracy",
        scoreOperator: "gte",
        scoreThreshold: 0.9,
        sinceDays: 7,
        limit: 100,
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/datasets/ds-1/items/from-traces`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.scoreName).toBe("accuracy");
      expect(body.scoreOperator).toBe("gte");
      expect(body.scoreThreshold).toBe(0.9);
    });
  });

  // ── Experiments ───────────────────────────────────────────────────────────

  describe("experiments", () => {
    it("createExperiment sends datasetId, name, and config", async () => {
      const client = makeClient();
      mockOk({ experiment: { id: "exp-1" }, runCount: 10, message: "ok" });

      await client.createExperiment({
        datasetId: "ds-1",
        name: "v2-test",
        config: { model: "claude-sonnet-4-20250514" },
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/experiments`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.datasetId).toBe("ds-1");
      expect(body.name).toBe("v2-test");
    });

    it("listExperiments forwards datasetId filter", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.listExperiments({ datasetId: "ds-1" });

      expect(lastCallUrl()).toContain("datasetId=ds-1");
    });

    it("listExperiments works without params", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.listExperiments();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/experiments?`);
    });

    it("compareExperiments sends comma-separated IDs", async () => {
      const client = makeClient();
      mockOk({ experiments: [], runs: [], items: [], scores: [] });

      await client.compareExperiments(["exp-1", "exp-2", "exp-3"]);

      const url = lastCallUrl();
      expect(url).toContain("experiment_ids=exp-1%2Cexp-2%2Cexp-3");
    });

    it("deleteExperiment sends DELETE", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteExperiment("exp-1");

      expect(lastCallOpts().method).toBe("DELETE");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/experiments/exp-1`);
    });
  });

  // ── Alert Rules & Channels ────────────────────────────────────────────────

  describe("alert rules and channels", () => {
    it("createAlertRule sends correct body", async () => {
      const client = makeClient();
      mockOk({ id: "rule-1" });

      await client.createAlertRule({
        eventType: "cost_spike",
        minSeverity: "critical",
        channelId: "ch-1",
      });

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.eventType).toBe("cost_spike");
      expect(body.minSeverity).toBe("critical");
    });

    it("deleteAlertRule throws because the backend route is not supported", async () => {
      const client = makeClient();

      await expect(client.deleteAlertRule("rule-1")).rejects.toThrow("not supported");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("createChannel sends name, kind, and config", async () => {
      const client = makeClient();
      mockOk({ id: "ch-1" });

      await client.createChannel({
        name: "Slack Alerts",
        kind: "slack",
        config: { webhookUrl: "https://hooks.slack.com/xxx" },
      });

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.name).toBe("Slack Alerts");
      expect(body.kind).toBe("slack");
    });

    it("testChannel sends defaults for eventType and severity", async () => {
      const client = makeClient();
      mockOk({ ok: true });

      await client.testChannel("ch-1");

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.channelId).toBe("ch-1");
      expect(body.eventType).toBe("agent_failure");
      expect(body.severity).toBe("high");
    });
  });

  // ── API Keys ──────────────────────────────────────────────────────────────

  describe("API keys", () => {
    it("createApiKey sends name in body", async () => {
      const client = makeClient();
      mockOk({ id: "key-1", key: "fox_xxx" });

      await client.createApiKey("My CLI Key");

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ name: "My CLI Key" });
    });

    it("createApiKey sends expiresAt when provided", async () => {
      const client = makeClient();
      mockOk({ id: "key-2", key: "fox_yyy" });

      await client.createApiKey("Expiring Key", { expiresAt: "2027-01-01T00:00:00Z" });

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ name: "Expiring Key", expiresAt: "2027-01-01T00:00:00Z" });
    });

    it("revokeApiKey sends DELETE", async () => {
      const client = makeClient();
      mockOk({ success: true });

      await client.revokeApiKey("key-1");

      expect(lastCallOpts().method).toBe("DELETE");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/api-keys/key-1`);
    });
  });

  // ── Budgets & SLAs ────────────────────────────────────────────────────────

  describe("budgets and SLAs", () => {
    it("setBudget sends PUT with config", async () => {
      const client = makeClient();
      mockOk({ id: "cfg-1" });

      await client.setBudget("agent-1", {
        costBudgetUsd: 50,
        costAlertThresholdPct: 80,
        budgetPeriod: "monthly",
      });

      expect(lastCallOpts().method).toBe("PUT");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/budgets/agent-1`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.costBudgetUsd).toBe(50);
    });

    it("listBudgets forwards pagination", async () => {
      const client = makeClient();
      mockOk({ data: [], pagination: { page: 1, limit: 10, count: 0 } });

      await client.listBudgets({ page: 1, limit: 10 });

      const url = lastCallUrl();
      expect(url).toContain("page=1");
      expect(url).toContain("limit=10");
    });

    it("setSla sends PUT with SLA params", async () => {
      const client = makeClient();
      mockOk({ id: "cfg-1" });

      await client.setSla("agent-1", {
        maxDurationMs: 30000,
        minSuccessRate: 0.99,
      });

      expect(lastCallOpts().method).toBe("PUT");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/slas/agent-1`);
    });

    it("deleteBudget sends DELETE", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteBudget("agent-1");

      expect(lastCallOpts().method).toBe("DELETE");
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/budgets/agent-1`);
    });
  });

  // ── Regressions ───────────────────────────────────────────────────────────

  describe("regressions", () => {
    it("getRegression fetches agent-specific report", async () => {
      const client = makeClient();
      mockOk({ agentId: "agent-1", regressions: [] });

      await client.getRegression("agent-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/regressions/agent-1`);
    });

    it("compareVersions sends versionA and versionB", async () => {
      const client = makeClient();
      mockOk({ regressions: [] });

      await client.compareVersions("agent-1", "v1.0", "v2.0");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/regressions/agent-1/compare`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ versionA: "v1.0", versionB: "v2.0" });
    });

    it("listBaselines fetches baselines for agent", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.listBaselines("agent-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/regressions/agent-1/baselines`);
    });

    it("deleteBaseline sends version as query param", async () => {
      const client = makeClient();
      mockOk({});

      await client.deleteBaseline("agent-1", "v1.0");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/regressions/agent-1/baselines?version=v1.0`);
      expect(lastCallOpts().method).toBe("DELETE");
    });
  });

  // ── Annotation Queues ─────────────────────────────────────────────────────

  describe("annotation queues", () => {
    it("createAnnotationQueue sends config", async () => {
      const client = makeClient();
      mockOk({ id: "queue-1" });

      await client.createAnnotationQueue({
        name: "Review Queue",
        description: "Manual review",
        scoreConfigs: [{ name: "quality", type: "numeric" }],
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/annotation-queues`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.name).toBe("Review Queue");
    });

    it("addAnnotationItems sends traceIds to queue-scoped endpoint", async () => {
      const client = makeClient();
      mockOk({ added: 2, items: [] });

      await client.addAnnotationItems("queue-1", ["trace-1", "trace-2"]);

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/annotation-queues/queue-1/items`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.traceIds).toEqual(["trace-1", "trace-2"]);
    });

    it("claimAnnotationItem returns null on 204", async () => {
      const client = makeClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      });

      const result = await client.claimAnnotationItem("queue-1");

      expect(result).toBeNull();
      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/annotation-queues/queue-1/claim`);
    });

    it("claimAnnotationItem returns item on success", async () => {
      const client = makeClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "item-1", traceId: "trace-1" }),
      });

      const result = await client.claimAnnotationItem("queue-1");

      expect(result).toEqual({ id: "item-1", traceId: "trace-1" });
    });

    it("claimAnnotationItem throws on non-OK non-204 response", async () => {
      const client = makeClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        text: () => Promise.resolve("Queue is empty"),
      });

      await expect(client.claimAnnotationItem("queue-1")).rejects.toThrow(
        "Foxhound API 409: Queue is empty",
      );
    });

    it("submitAnnotationItem posts scores", async () => {
      const client = makeClient();
      mockOk({ item: {}, scores: [] });

      await client.submitAnnotationItem("item-1", [{ name: "quality", value: 4, comment: "Good" }]);

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/annotation-queue-items/item-1/submit`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.scores).toHaveLength(1);
      expect(body.scores[0].name).toBe("quality");
    });

    it("skipAnnotationItem posts to skip endpoint", async () => {
      const client = makeClient();
      mockOk({ id: "item-1" });

      await client.skipAnnotationItem("item-1");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/annotation-queue-items/item-1/skip`);
      expect(lastCallOpts().method).toBe("POST");
    });
  });

  // ── Billing ───────────────────────────────────────────────────────────────

  describe("billing", () => {
    it("createCheckout sends plan and URLs", async () => {
      const client = makeClient();
      mockOk({ url: "https://checkout.stripe.com/xxx" });

      await client.createCheckout({
        plan: "pro_monthly",
        successUrl: "https://app.foxhound.caleb-love.com/success",
        cancelUrl: "https://app.foxhound.caleb-love.com/cancel",
      });

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/billing/checkout`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.plan).toBe("pro_monthly");
    });

    it("createPortalSession sends returnUrl", async () => {
      const client = makeClient();
      mockOk({ url: "https://billing.stripe.com/xxx" });

      await client.createPortalSession("https://app.foxhound.caleb-love.com/settings");

      const body = JSON.parse(lastCallOpts().body as string);
      expect(body.returnUrl).toBe("https://app.foxhound.caleb-love.com/settings");
    });

    it("getBillingStatus fetches status endpoint", async () => {
      const client = makeClient();
      mockOk({ plan: "pro", period: "monthly", spanCount: 1000, nextBillingDate: null });

      const result = await client.getBillingStatus();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/billing/status`);
      expect(result.plan).toBe("pro");
    });

    it("getUsage fetches billing usage", async () => {
      const client = makeClient();
      mockOk({ spansUsed: 500, spansLimit: 10000, period: "2026-04" });

      const result = await client.getUsage();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/billing/usage`);
      expect(result.spansUsed).toBe(500);
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe("auth", () => {
    it("login sends email and password", async () => {
      const client = makeClient();
      mockOk({ token: "jwt-abc", user: {}, org: {} });

      await client.login("user@test.com", "pass123");

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/auth/login`);
      const body = JSON.parse(lastCallOpts().body as string);
      expect(body).toEqual({ email: "user@test.com", password: "pass123" });
    });

    it("getMe fetches current user", async () => {
      const client = makeClient();
      mockOk({ user: { id: "u-1" }, org: null, role: null });

      const result = await client.getMe();

      expect(lastCallUrl()).toBe(`${BASE_URL}/v1/auth/me`);
      expect(result.user.id).toBe("u-1");
    });
  });
});
