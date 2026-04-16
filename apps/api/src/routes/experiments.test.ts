import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { experimentsRoutes } from "./experiments.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createExperiment: vi.fn(),
  listExperiments: vi.fn(),
  getExperiment: vi.fn(),
  deleteExperiment: vi.fn(),
  getDataset: vi.fn(),
  listDatasetItems: vi.fn(),
  createExperimentRuns: vi.fn(),
  listExperimentRuns: vi.fn(),
  getExperimentComparison: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
}));

vi.mock("../queue.js", () => ({
  getExperimentQueue: vi.fn(() => null),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(experimentsRoutes);
  return app;
}

function mockApiKey(orgId = "org_1", scopes: string | null = null) {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
      expiresAt: null,
      scopes,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "Test Org",
      slug: "test-org",
      plan: "free" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      llmEvaluationEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describe("POST /v1/experiments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an experiment and enqueues async job", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    vi.mocked(db.listDatasetItems).mockResolvedValue([
      {
        id: "dsi_1",
        datasetId: "ds_123",
        input: { prompt: "hello" },
        expectedOutput: null,
        metadata: {},
        sourceTraceId: null,
        createdAt: new Date(),
      },
    ]);
    vi.mocked(db.createExperiment).mockResolvedValue({
      id: "exp_123",
      orgId: "org_1",
      datasetId: "ds_123",
      name: "test-experiment",
      config: { model: "gpt-4o", promptTemplate: "Answer: {{input}}" },
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
    });
    vi.mocked(db.createExperimentRuns).mockResolvedValue([
      {
        id: "exr_1",
        experimentId: "exp_123",
        datasetItemId: "dsi_1",
        output: null,
        latencyMs: null,
        tokenCount: null,
        cost: null,
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/experiments",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        datasetId: "ds_123",
        name: "test-experiment",
        config: { model: "gpt-4o", promptTemplate: "Answer: {{input}}" },
      },
    });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toMatchObject({ experiment: { name: "test-experiment" } });
  });

  it("rejects if dataset not found", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/experiments",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        datasetId: "ds_nope",
        name: "test",
        config: { model: "gpt-4o" },
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /v1/experiments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes datasetId, search, and experimentId filters through to listExperiments", async () => {
    mockApiKey();
    vi.mocked(db.listExperiments).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiments?datasetId=ds_123&q=refund&experimentId=exp_1&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listExperiments)).toHaveBeenCalledWith({
      orgId: "org_1",
      datasetId: "ds_123",
      searchQuery: "refund",
      experimentIds: ["exp_1"],
    });
  });
});

describe("GET /v1/experiment-comparisons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns side-by-side comparison", async () => {
    mockApiKey();
    vi.mocked(db.getExperimentComparison).mockResolvedValue({
      experiments: [],
      runs: [],
      items: [],
      scores: [],
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiment-comparisons?experiment_ids=exp_1,exp_2",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty("experiments");
  });

  it("rejects missing experiment_ids param", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiment-comparisons",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when api key lacks experiments:read scope", async () => {
    mockApiKey("org_1", "datasets:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiment-comparisons?experiment_ids=exp_1,exp_2",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("experiments:read");
  });
});
