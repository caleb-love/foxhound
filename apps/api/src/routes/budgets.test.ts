import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { budgetsRoutes } from "./budgets.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  upsertAgentConfig: vi.fn(),
  getAgentConfig: vi.fn(),
  listBudgetConfigs: vi.fn(),
  countBudgetConfigs: vi.fn(),
  deleteAgentConfig: vi.fn(),
}));

vi.mock("../lib/config-cache.js", () => ({
  setCacheEntry: vi.fn(),
  deleteCacheEntry: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(budgetsRoutes);
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

const baseBudgetConfig = {
  id: "ac_123",
  orgId: "org_1",
  agentId: "agent_1",
  costBudgetUsd: "100.00",
  costAlertThresholdPct: 80,
  budgetPeriod: "monthly" as const,
  maxDurationMs: null,
  minSuccessRate: null,
  evaluationWindowMs: null,
  minSampleSize: null,
  lastCostStatus: null,
  lastSlaStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PUT /v1/budgets/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new budget (201)", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(undefined);
    vi.mocked(db.upsertAgentConfig).mockResolvedValue(baseBudgetConfig);

    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/v1/budgets/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { costBudgetUsd: 100 },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1", costBudgetUsd: "100.00" });
  });

  it("updates existing budget (200)", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(baseBudgetConfig);
    const updated = { ...baseBudgetConfig, costBudgetUsd: "200.00" };
    vi.mocked(db.upsertAgentConfig).mockResolvedValue(updated);

    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/v1/budgets/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { costBudgetUsd: 200 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ costBudgetUsd: "200.00" });
  });
});

describe("GET /v1/budgets/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns budget config", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(baseBudgetConfig);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/budgets/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1" });
  });

  it("returns 404 for non-existent", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(undefined);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/budgets/agent_missing",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /v1/budgets/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes budget (204)", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(baseBudgetConfig);
    vi.mocked(db.deleteAgentConfig).mockResolvedValue(true);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/budgets/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(204);
  });
});

describe("GET /v1/budgets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns filtered paginated budgets with true total count", async () => {
    mockApiKey();
    vi.mocked(db.listBudgetConfigs).mockResolvedValue([baseBudgetConfig]);
    vi.mocked(db.countBudgetConfigs).mockResolvedValue(9);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/budgets?page=1&limit=10",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("pagination");
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toMatchObject({ page: 1, limit: 10, count: 9 });
    expect(vi.mocked(db.listBudgetConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 10,
      searchQuery: undefined,
      agentIds: undefined,
    });
    expect(vi.mocked(db.countBudgetConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 10,
      searchQuery: undefined,
      agentIds: undefined,
    });
  });

  it("accepts shared-style search and agentId filters without applying event-window semantics", async () => {
    mockApiKey();
    vi.mocked(db.listBudgetConfigs).mockResolvedValue([baseBudgetConfig]);
    vi.mocked(db.countBudgetConfigs).mockResolvedValue(1);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/budgets?q=agent&agentId=agent_1&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listBudgetConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "agent",
      agentIds: ["agent_1"],
    });
    expect(vi.mocked(db.countBudgetConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "agent",
      agentIds: ["agent_1"],
    });
  });

  it("returns 403 when api key lacks budgets:read scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/budgets",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("budgets:read");
  });
});
