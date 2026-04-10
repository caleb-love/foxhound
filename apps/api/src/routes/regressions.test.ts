import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { regressionsRoutes } from "./regressions.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  getRecentBaselines: vi.fn(),
  deleteBaseline: vi.fn(),
  getBaseline: vi.fn(),
  getSpanStructureForVersion: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(regressionsRoutes);
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

describe("GET /v1/regressions/:agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty regressions with no baselines", async () => {
    mockApiKey();
    vi.mocked(db.getRecentBaselines).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/regressions/agent_1",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.regressions).toEqual([]);
    expect(body.message).toMatch(/Insufficient baselines/);
  });
});

describe("POST /v1/regressions/:agentId/compare", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compares two versions", async () => {
    mockApiKey();
    vi.mocked(db.getBaseline).mockResolvedValueOnce({
      id: "bl_1",
      orgId: "org_1",
      agentId: "agent_1",
      agentVersion: "v1",
      spanStructure: { "llm.call": 0.9, "tool.search": 0.8 },
      sampleSize: 50,
      createdAt: new Date(),
    });
    vi.mocked(db.getBaseline).mockResolvedValueOnce({
      id: "bl_2",
      orgId: "org_1",
      agentId: "agent_1",
      agentVersion: "v2",
      spanStructure: { "llm.call": 0.9, "tool.search": 0.05, "tool.newTool": 0.7 },
      sampleSize: 60,
      createdAt: new Date(),
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/regressions/agent_1/compare",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { versionA: "v1", versionB: "v2" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.previousVersion).toBe("v1");
    expect(body.newVersion).toBe("v2");
    expect(body.regressions.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/regressions/:agentId/baselines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of baselines", async () => {
    mockApiKey();
    vi.mocked(db.getRecentBaselines).mockResolvedValue([
      {
        id: "bl_1",
        orgId: "org_1",
        agentId: "agent_1",
        agentVersion: "v1",
        spanStructure: { "llm.call": 0.9 },
        sampleSize: 50,
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/regressions/agent_1/baselines",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveLength(1);
  });
});

describe("DELETE /v1/regressions/:agentId/baselines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires version query param", async () => {
    mockApiKey();

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/regressions/agent_1/baselines",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: "version query parameter is required" });
  });
});
