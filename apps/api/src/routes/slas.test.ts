import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { slasRoutes } from "./slas.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  upsertAgentConfig: vi.fn(),
  getAgentConfig: vi.fn(),
  listAgentConfigs: vi.fn(),
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

function mockApiKey(orgId = "org_1") {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PUT /v1/slas/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates SLA (201)", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(undefined);
    vi.mocked(db.upsertAgentConfig).mockResolvedValue(baseSlaConfig as any);

    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { maxDurationMs: 5000, minSuccessRate: 0.95 },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1", maxDurationMs: 5000 });
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

describe("GET /v1/slas/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns SLA config", async () => {
    mockApiKey();
    vi.mocked(db.getAgentConfig).mockResolvedValue(baseSlaConfig as any);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/slas/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ agentId: "agent_1", maxDurationMs: 5000 });
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
      budgetPeriod: "monthly",
    };
    vi.mocked(db.getAgentConfig).mockResolvedValue(configWithBudget as any);
    vi.mocked(db.upsertAgentConfig).mockResolvedValue({
      ...configWithBudget,
      maxDurationMs: null,
      minSuccessRate: null,
      evaluationWindowMs: null,
      minSampleSize: null,
    } as any);

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
