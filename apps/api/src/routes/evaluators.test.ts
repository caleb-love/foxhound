import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { evaluatorsRoutes } from "./evaluators.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createEvaluator: vi.fn(),
  listEvaluators: vi.fn(),
  getEvaluator: vi.fn(),
  updateEvaluator: vi.fn(),
  deleteEvaluator: vi.fn(),
  createEvaluatorRuns: vi.fn(),
  getEvaluatorRunForOrg: vi.fn(),
  getTrace: vi.fn(),
  isLlmEvaluationEnabled: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn().mockResolvedValue({
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    canEvaluate: true,
    canManagePrompts: true,
    maxSpans: -1,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  }),
  invalidateEntitlements: vi.fn(),
}));

vi.mock("../queue.js", () => ({
  getEvaluatorQueue: vi.fn().mockReturnValue(null),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(evaluatorsRoutes);
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

const AUTH = { authorization: "Bearer sk-testkey123" };

describe("POST /v1/evaluators", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an evaluator", async () => {
    mockApiKey();
    const created = {
      id: "evl_123",
      orgId: "org_1",
      name: "Helpfulness",
      promptTemplate: "Rate the helpfulness of this response",
      model: "gpt-4o",
      scoringType: "numeric" as const,
      labels: null,
      enabled: true,
      createdAt: new Date(),
    };
    vi.mocked(db.createEvaluator).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluators",
      headers: AUTH,
      payload: {
        name: "Helpfulness",
        promptTemplate: "Rate the helpfulness of this response",
        model: "gpt-4o",
        scoringType: "numeric",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ name: "Helpfulness" });
    expect(db.createEvaluator).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        name: "Helpfulness",
        model: "gpt-4o",
        scoringType: "numeric",
      }),
    );
  });

  it("rejects categorical evaluator without labels", async () => {
    mockApiKey();

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluators",
      headers: AUTH,
      payload: {
        name: "Sentiment",
        promptTemplate: "Classify sentiment",
        model: "gpt-4o",
        scoringType: "categorical",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({
      error: "Categorical evaluators require at least one label",
    });
  });

  it("returns 400 for invalid body", async () => {
    mockApiKey();

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluators",
      headers: AUTH,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toHaveProperty("issues");
  });

  it("returns 403 when api key lacks evaluators:write scope", async () => {
    mockApiKey("org_1", "evaluators:read");

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluators",
      headers: AUTH,
      payload: {
        name: "Helpfulness",
        promptTemplate: "Rate the helpfulness of this response",
        model: "gpt-4o",
        scoringType: "numeric",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("evaluators:write");
  });
});

describe("GET /v1/evaluators", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists evaluators for the org", async () => {
    mockApiKey();
    vi.mocked(db.listEvaluators).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluators",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty("data");
    expect(db.listEvaluators).toHaveBeenCalledWith({
      orgId: "org_1",
      searchQuery: undefined,
      evaluatorIds: undefined,
    });
  });

  it("accepts shared-style search and evaluatorId filters without applying event-window semantics", async () => {
    mockApiKey();
    vi.mocked(db.listEvaluators).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluators?q=quality&evaluatorId=evl_123&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(db.listEvaluators).toHaveBeenCalledWith({
      orgId: "org_1",
      searchQuery: "quality",
      evaluatorIds: ["evl_123"],
    });
  });

  it("returns 403 when api key lacks evaluators:read scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluators",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("evaluators:read");
  });
});

describe("GET /v1/evaluators/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an evaluator", async () => {
    mockApiKey();
    const evaluator = {
      id: "evl_123",
      orgId: "org_1",
      name: "Helpfulness",
      promptTemplate: "Rate helpfulness",
      model: "gpt-4o",
      scoringType: "numeric" as const,
      labels: null,
      enabled: true,
      createdAt: new Date(),
    };
    vi.mocked(db.getEvaluator).mockResolvedValue(evaluator);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluators/evl_123",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: "evl_123", name: "Helpfulness" });
    expect(db.getEvaluator).toHaveBeenCalledWith("evl_123", "org_1");
  });

  it("returns 404 for missing evaluator", async () => {
    mockApiKey();
    vi.mocked(db.getEvaluator).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluators/evl_missing",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Not Found" });
  });
});

describe("PATCH /v1/evaluators/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an evaluator", async () => {
    mockApiKey();
    const updated = {
      id: "evl_123",
      orgId: "org_1",
      name: "Updated Name",
      promptTemplate: "Rate helpfulness",
      model: "gpt-4o",
      scoringType: "numeric" as const,
      labels: null,
      enabled: true,
      createdAt: new Date(),
    };
    vi.mocked(db.updateEvaluator).mockResolvedValue(updated);

    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/evaluators/evl_123",
      headers: AUTH,
      payload: { name: "Updated Name" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ name: "Updated Name" });
    expect(db.updateEvaluator).toHaveBeenCalledWith("evl_123", "org_1", { name: "Updated Name" });
  });

  it("returns 404 for missing evaluator", async () => {
    mockApiKey();
    vi.mocked(db.updateEvaluator).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/evaluators/evl_missing",
      headers: AUTH,
      payload: { name: "Nope" },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Not Found" });
  });
});

describe("DELETE /v1/evaluators/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an evaluator and returns 204", async () => {
    mockApiKey();
    vi.mocked(db.deleteEvaluator).mockResolvedValue(true);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/evaluators/evl_123",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    expect(db.deleteEvaluator).toHaveBeenCalledWith("evl_123", "org_1");
  });

  it("returns 404 for missing evaluator", async () => {
    mockApiKey();
    vi.mocked(db.deleteEvaluator).mockResolvedValue(false);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/evaluators/evl_missing",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Not Found" });
  });
});

describe("POST /v1/evaluator-runs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when LLM evaluation is not enabled", async () => {
    mockApiKey();
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(false);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluator-runs",
      headers: AUTH,
      payload: { evaluatorId: "evl_123", traceIds: ["trace_1"] },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Forbidden" });
  });

  it("returns 404 for missing evaluator", async () => {
    mockApiKey();
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);
    vi.mocked(db.getEvaluator).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluator-runs",
      headers: AUTH,
      payload: { evaluatorId: "evl_missing", traceIds: ["trace_1"] },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Not Found" });
  });

  it("returns 202 on success and queues runs", async () => {
    mockApiKey();
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);
    vi.mocked(db.getEvaluator).mockResolvedValue({
      id: "evl_123",
      orgId: "org_1",
      name: "Helpfulness",
      promptTemplate: "Rate helpfulness",
      model: "gpt-4o",
      scoringType: "numeric" as const,
      labels: null,
      enabled: true,
      createdAt: new Date(),
    });
    vi.mocked(db.getTrace).mockResolvedValue({
      id: "trace_1",
      orgId: "org_1",
      agentId: "agent_1",
      sessionId: null,
      parentAgentId: null,
      correlationId: null,
      startTimeMs: 1000,
      endTimeMs: 2000,
      spans: [],
      metadata: {},
      createdAt: new Date(),
    });
    vi.mocked(db.createEvaluatorRuns).mockResolvedValue([
      {
        id: "evr_1",
        evaluatorId: "evl_123",
        traceId: "trace_1",
        scoreId: null,
        status: "pending" as const,
        error: null,
        createdAt: new Date(),
        completedAt: null,
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/evaluator-runs",
      headers: AUTH,
      payload: { evaluatorId: "evl_123", traceIds: ["trace_1"] },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("1 evaluation run(s) queued");
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({ id: "evr_1", traceId: "trace_1", status: "pending" });
  });
});

describe("GET /v1/evaluator-runs/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an evaluator run", async () => {
    mockApiKey();
    const run = {
      id: "evr_1",
      evaluatorId: "evl_123",
      traceId: "trace_1",
      scoreId: "scr_1",
      status: "completed" as const,
      error: null,
      createdAt: new Date(),
      completedAt: new Date(),
    };
    vi.mocked(db.getEvaluatorRunForOrg).mockResolvedValue(run);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluator-runs/evr_1",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: "evr_1", status: "completed" });
    expect(db.getEvaluatorRunForOrg).toHaveBeenCalledWith("evr_1", "org_1");
  });

  it("returns 404 for missing evaluator run", async () => {
    mockApiKey();
    vi.mocked(db.getEvaluatorRunForOrg).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/evaluator-runs/evr_missing",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: "Not Found" });
  });
});
