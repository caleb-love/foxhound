import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { slasRoutes } from "./slas.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  upsertAgentConfig: vi.fn(),
  getAgentConfig: vi.fn(),
  listSlaConfigs: vi.fn(),
  countSlaConfigs: vi.fn(),
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
  void app.register(slasRoutes);
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

const baseSlaConfig = {
  id: "ac_456",
  orgId: "org_1",
  agentId: "agent_1",
  costBudgetUsd: null,
  costAlertThresholdPct: null,
  budgetPeriod: null,
  maxDurationMs: 5000,
  minSuccessRate: "0.95",
  evaluationWindowMs: 86400000,
  minSampleSize: 10,
  lastCostStatus: null,
  lastSlaStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PUT /v1/slas/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates SLA (201)", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(undefined);
    vi.mocked(db.upsertAgentConfig).mockResolvedValue(baseSlaConfig);

    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { maxDurationMs: 5000, minSuccessRate: 0.95 },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1", maxDurationMs: 5000 });
    // Verify org_id scoping — route must pass the authenticated org's ID
    expect(db.upsertAgentConfig).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org_1", agentId: "agent_1" }),
    );
  });

  it("rejects when neither maxDurationMs nor minSuccessRate provided (400)", async () => {
    mockApiKey();

    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { evaluationWindowMs: 86400000 },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/slas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns filtered paginated slas with true total count", async () => {
    mockApiKey();
    vi.mocked(db.listSlaConfigs).mockResolvedValue([baseSlaConfig]);
    vi.mocked(db.countSlaConfigs).mockResolvedValue(6);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/slas?page=1&limit=10",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("pagination");
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toMatchObject({ page: 1, limit: 10, count: 6 });
    expect(vi.mocked(db.listSlaConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 10,
      searchQuery: undefined,
      agentIds: undefined,
    });
    expect(vi.mocked(db.countSlaConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 10,
      searchQuery: undefined,
      agentIds: undefined,
    });
  });

  it("accepts shared-style search and agentId filters without applying event-window semantics", async () => {
    mockApiKey();
    vi.mocked(db.listSlaConfigs).mockResolvedValue([baseSlaConfig]);
    vi.mocked(db.countSlaConfigs).mockResolvedValue(1);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/slas?q=agent&agentId=agent_1&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listSlaConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "agent",
      agentIds: ["agent_1"],
    });
    expect(vi.mocked(db.countSlaConfigs)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "agent",
      agentIds: ["agent_1"],
    });
  });
});

describe("GET /v1/slas/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns SLA config", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(baseSlaConfig);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1", maxDurationMs: 5000 });
    // Verify org_id scoping on read
    expect(db.getAgentConfig).toHaveBeenCalledWith("org_1", "agent_1");
  });
});

describe("DELETE /v1/slas/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes SLA but preserves budget if it exists", async () => {
    mockApiKey();
    const configWithBudget = {
      ...baseSlaConfig,
      costBudgetUsd: "100.00",
      costAlertThresholdPct: 80,
      budgetPeriod: "monthly" as const,
    };
    vi.mocked(db.getAgentConfig).mockResolvedValue(configWithBudget);
    vi.mocked(db.upsertAgentConfig).mockResolvedValue({
      ...configWithBudget,
      maxDurationMs: null,
      minSuccessRate: null,
      evaluationWindowMs: null,
      minSampleSize: null,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(204);
    // Should have called upsertAgentConfig (not deleteAgentConfig) to preserve budget
    expect(db.upsertAgentConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        costBudgetUsd: "100.00",
        maxDurationMs: null,
        minSuccessRate: null,
      }),
    );
    expect(db.deleteAgentConfig).not.toHaveBeenCalled();
  });
});

describe("Auth enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without authorization header", async () => {
    const app = buildApp();

    const putRes = await app.inject({
      method: "PUT",
      url: "/v1/slas/agent_1",
      payload: { maxDurationMs: 5000 },
    });
    expect(putRes.statusCode).toBe(401);

    const getRes = await app.inject({
      method: "GET",
      url: "/v1/slas/agent_1",
    });
    expect(getRes.statusCode).toBe(401);

    const delRes = await app.inject({
      method: "DELETE",
      url: "/v1/slas/agent_1",
    });
    expect(delRes.statusCode).toBe(401);
  });

  it("returns 403 when api key lacks slas:read scope", async () => {
    mockApiKey("org_1", "scores:read");
    const app = buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("slas:read");
  });

  it("returns 403 when api key lacks slas:write scope", async () => {
    mockApiKey("org_1", "slas:read");
    const app = buildApp();

    const res = await app.inject({
      method: "PUT",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { maxDurationMs: 5000 },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("slas:write");
  });
});
