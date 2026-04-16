import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { datasetsRoutes } from "./datasets.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
  getDataset: vi.fn(),
  deleteDataset: vi.fn(),
  createDatasetItem: vi.fn(),
  createDatasetItems: vi.fn(),
  listDatasetItems: vi.fn(),
  deleteDatasetItem: vi.fn(),
  countDatasetItems: vi.fn(),
  getTracesForDatasetCuration: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(datasetsRoutes);
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

describe("POST /v1/datasets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a dataset", async () => {
    mockApiKey();
    const created = {
      id: "ds_123",
      orgId: "org_1",
      name: "my-eval-set",
      description: "Test dataset",
      createdAt: new Date(),
    };
    vi.mocked(db.createDataset).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { name: "my-eval-set", description: "Test dataset" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ name: "my-eval-set" });
  });

  it("rejects missing name", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/datasets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists datasets for the org", async () => {
    mockApiKey();
    vi.mocked(db.listDatasets).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty("data");
    expect(vi.mocked(db.listDatasets)).toHaveBeenCalledWith({
      orgId: "org_1",
      searchQuery: undefined,
      datasetIds: undefined,
    });
  });

  it("accepts shared-style search and datasetId filters without applying event-window semantics", async () => {
    mockApiKey();
    vi.mocked(db.listDatasets).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/datasets?q=refund&datasetId=ds_123&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listDatasets)).toHaveBeenCalledWith({
      orgId: "org_1",
      searchQuery: "refund",
      datasetIds: ["ds_123"],
    });
  });

  it("returns 403 when api key lacks datasets:read scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("datasets:read");
  });
});

describe("GET /v1/datasets/:id/items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns total dataset item count, not page-local length", async () => {
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
        id: "item_1",
        datasetId: "ds_123",
        input: { prompt: "hello" },
        expectedOutput: null,
        metadata: {},
        sourceTraceId: null,
        createdAt: new Date(),
      },
    ] as never);
    vi.mocked(db.countDatasetItems).mockResolvedValue(14);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/datasets/ds_123/items?page=1&limit=10",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toMatchObject({ page: 1, limit: 10, count: 14 });
    expect(vi.mocked(db.countDatasetItems)).toHaveBeenCalledWith("ds_123", "org_1");
  });
});

describe("POST /v1/datasets/:id/items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a dataset item", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    const created = {
      id: "dsi_123",
      datasetId: "ds_123",
      input: { prompt: "hello" },
      expectedOutput: { response: "hi" },
      metadata: {},
      sourceTraceId: null,
      createdAt: new Date(),
    };
    vi.mocked(db.createDatasetItem).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets/ds_123/items",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { input: { prompt: "hello" }, expectedOutput: { response: "hi" } },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ datasetId: "ds_123" });
  });
});

describe("POST /v1/datasets/:id/items/from-traces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("curates items from traces matching score filter", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    vi.mocked(db.getTracesForDatasetCuration).mockResolvedValue([
      {
        trace: {
          id: "trace_1",
          orgId: "org_1",
          agentId: "agent_1",
          sessionId: null,
          parentAgentId: null,
          correlationId: null,
          startTimeMs: 1000,
          endTimeMs: null,
          spans: [],
          metadata: {},
          createdAt: new Date(),
        },
        spans: [
          {
            id: "span_1",
            traceId: "trace_1",
            orgId: "org_1",
            parentSpanId: null,
            name: "step",
            kind: "agent_step",
            status: "ok",
            startTimeMs: 1000,
            endTimeMs: 2000,
            costUsd: null,
            attributes: { input: "hello", output: "world" },
            events: [],
            createdAt: new Date(),
          },
        ],
      },
    ]);
    vi.mocked(db.createDatasetItems).mockResolvedValue([
      {
        id: "dsi_1",
        datasetId: "ds_123",
        input: { input: "hello" },
        expectedOutput: { output: "world" },
        metadata: {},
        sourceTraceId: "trace_1",
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets/ds_123/items/from-traces",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        scoreName: "helpfulness",
        scoreOperator: "lt",
        scoreThreshold: 0.5,
        sinceDays: 7,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.added).toBe(1);
  });
});
