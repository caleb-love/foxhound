import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { scoresRoutes } from "./scores.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createScore: vi.fn(),
  queryScores: vi.fn(),
  countScores: vi.fn(),
  getScoresByTraceId: vi.fn(),
  deleteScore: vi.fn(),
  getTrace: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(scoresRoutes);
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

describe("POST /v1/scores — create score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates score when valid", async () => {
    mockApiKey("org_1");
    vi.mocked(db.getTrace).mockResolvedValue({
      id: "trace_1",
      orgId: "org_1",
      agentId: "agent_1",
      sessionId: null,
      startTimeMs: Date.now(),
      endTimeMs: null,
      spans: [],
      metadata: {},
      parentAgentId: null,
      correlationId: null,
      createdAt: new Date(),
    });
    const mockScore = {
      id: "scr_abc123",
      orgId: "org_1",
      traceId: "trace_1",
      spanId: null,
      name: "accuracy",
      value: 0.95,
      label: null,
      source: "manual" as const,
      comment: null,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.createScore).mockResolvedValue(mockScore);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      headers: { authorization: "Bearer sk-test-key" },
      body: {
        traceId: "trace_1",
        name: "accuracy",
        value: 0.95,
        source: "manual",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe("scr_abc123");
    expect(body.traceId).toBe("trace_1");
    expect(db.createScore).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        traceId: "trace_1",
        name: "accuracy",
        value: 0.95,
        source: "manual",
      }),
    );
  });

  it("returns 400 for invalid body", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      headers: { authorization: "Bearer sk-test-key" },
      body: { invalid: true },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("Bad Request");
  });

  it("returns 404 when trace not found", async () => {
    mockApiKey("org_1");
    vi.mocked(db.getTrace).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      headers: { authorization: "Bearer sk-test-key" },
      body: {
        traceId: "trace_missing",
        name: "accuracy",
        value: 0.8,
        source: "manual",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe("Trace not found");
    expect(db.getTrace).toHaveBeenCalledWith("trace_missing", "org_1");
  });

  it("returns 400 when neither value nor label provided", async () => {
    mockApiKey("org_1");
    vi.mocked(db.getTrace).mockResolvedValue({
      id: "trace_1",
      orgId: "org_1",
      agentId: "agent_1",
      sessionId: null,
      startTimeMs: Date.now(),
      endTimeMs: null,
      spans: [],
      metadata: {},
      parentAgentId: null,
      correlationId: null,
      createdAt: new Date(),
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      headers: { authorization: "Bearer sk-test-key" },
      body: {
        traceId: "trace_1",
        name: "accuracy",
        source: "manual",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toContain("value");
  });

  it("returns 401 without API key", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      body: {
        traceId: "trace_1",
        name: "accuracy",
        value: 0.9,
        source: "manual",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when api key lacks scores:write scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/scores",
      headers: { authorization: "Bearer sk-test-key" },
      body: {
        traceId: "trace_1",
        name: "accuracy",
        value: 0.9,
        source: "manual",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("scores:write");
  });
});

describe("GET /v1/scores — query scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated scores", async () => {
    mockApiKey("org_1");
    const mockRows = [
      {
        id: "scr_1",
        orgId: "org_1",
        traceId: "trace_1",
        spanId: null,
        name: "accuracy",
        value: 0.9,
        label: null,
        source: "manual" as const,
        comment: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(db.queryScores).mockResolvedValue(mockRows);
    vi.mocked(db.countScores).mockResolvedValue(17);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/scores?page=1&limit=10",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toMatchObject({ page: 1, limit: 10, count: 17 });
  });

  it("passes filters to queryScores", async () => {
    mockApiKey("org_1");
    vi.mocked(db.queryScores).mockResolvedValue([]);
    vi.mocked(db.countScores).mockResolvedValue(0);

    const app = buildApp();
    await app.inject({
      method: "GET",
      url: "/v1/scores?traceId=trace_1&name=accuracy&source=manual&minValue=0.5&maxValue=1.0",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(db.queryScores).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        traceId: "trace_1",
        name: "accuracy",
        source: "manual",
        minValue: 0.5,
        maxValue: 1.0,
      }),
    );
    expect(db.countScores).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        traceId: "trace_1",
        name: "accuracy",
        source: "manual",
        minValue: 0.5,
        maxValue: 1.0,
      }),
    );
  });
});

describe("GET /v1/traces/:id/scores — scores for trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns scores for trace", async () => {
    mockApiKey("org_1");
    const mockRows = [
      {
        id: "scr_1",
        orgId: "org_1",
        traceId: "trace_42",
        spanId: null,
        name: "relevance",
        value: 0.75,
        label: null,
        source: "llm_judge" as const,
        comment: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(db.getScoresByTraceId).mockResolvedValue(mockRows);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/trace_42/scores",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].traceId).toBe("trace_42");
    expect(db.getScoresByTraceId).toHaveBeenCalledWith("trace_42", "org_1");
  });
});

describe("DELETE /v1/scores/:id — delete score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 on success", async () => {
    mockApiKey("org_1");
    vi.mocked(db.deleteScore).mockResolvedValue(true);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/scores/scr_abc123",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(204);
    expect(db.deleteScore).toHaveBeenCalledWith("scr_abc123", "org_1");
  });

  it("returns 404 when not found", async () => {
    mockApiKey("org_1");
    vi.mocked(db.deleteScore).mockResolvedValue(false);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/scores/scr_missing",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe("Not Found");
    expect(body.message).toBe("Score not found");
  });
});
