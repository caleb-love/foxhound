import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { tracesRoutes } from "./traces.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  insertTrace: vi.fn(),
  insertSpans: vi.fn(),
  queryTraces: vi.fn(),
  getTrace: vi.fn(),
  getTraceWithSpans: vi.fn(),
  getReplayContext: vi.fn(),
  diffTraces: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
  checkSpanLimit: vi.fn(),
  incrementSpanCount: vi.fn(),
}));

import * as db from "@foxhound/db";
import * as billing from "@foxhound/billing";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(tracesRoutes);
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

function makeTrace(spanCount = 1) {
  return {
    id: "trace_abc123",
    agentId: "agent_1",
    sessionId: "session_1",
    startTimeMs: Date.now(),
    metadata: {},
    spans: Array.from({ length: spanCount }, (_, i) => ({
      traceId: "trace_abc123",
      spanId: `span_${i}`,
      name: `step_${i}`,
      kind: "agent_step",
      startTimeMs: Date.now() + i,
      status: "ok",
      attributes: {},
      events: [],
    })),
  };
}

describe("POST /v1/traces — span limit enforcement", () => {
  beforeEach(async () => {
    // Drain any setImmediate callbacks queued by the previous test before resetting mocks
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.clearAllMocks();
    vi.mocked(db.insertTrace).mockResolvedValue(undefined);
    vi.mocked(billing.incrementSpanCount).mockResolvedValue(undefined);
  });

  it("returns 202 when within free tier limit", async () => {
    mockApiKey();
    vi.mocked(billing.checkSpanLimit).mockResolvedValue({
      allowed: true,
      spansUsed: 5_000,
      spansLimit: 10_000,
      isOverage: false,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify(makeTrace(3)),
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ accepted: true, id: "trace_abc123" });
  });

  it("returns 429 when free tier span limit is exceeded", async () => {
    mockApiKey();
    vi.mocked(billing.checkSpanLimit).mockResolvedValue({
      allowed: false,
      spansUsed: 10_000,
      spansLimit: 10_000,
      isOverage: true,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify(makeTrace(5)),
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error).toBe("span_limit_exceeded");
    expect(body.spansUsed).toBe(10_000);
    expect(body.spansLimit).toBe(10_000);
    expect(body.message).toContain("10,000");
  });

  it("returns 202 for pro tier even when in overage", async () => {
    mockApiKey("org_pro");
    vi.mocked(billing.checkSpanLimit).mockResolvedValue({
      allowed: true,
      spansUsed: 550_000,
      spansLimit: 500_000,
      isOverage: true,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify(makeTrace(10)),
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ accepted: true });
  });

  it("calls checkSpanLimit with correct orgId and span count", async () => {
    mockApiKey("org_123");
    vi.mocked(billing.checkSpanLimit).mockResolvedValue({
      allowed: true,
      spansUsed: 0,
      spansLimit: 10_000,
      isOverage: false,
    });

    const app = buildApp();
    const trace = makeTrace(7);
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify(trace),
    });

    expect(billing.checkSpanLimit).toHaveBeenCalledWith("org_123", 7);
  });

  it("does not call insertTrace or incrementSpanCount when limit exceeded", async () => {
    mockApiKey();
    vi.mocked(billing.checkSpanLimit).mockResolvedValue({
      allowed: false,
      spansUsed: 10_000,
      spansLimit: 10_000,
      isOverage: true,
    });

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify(makeTrace(2)),
    });

    // Give setImmediate a chance to fire (it should NOT in the rejected path)
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(db.insertTrace).not.toHaveBeenCalled();
    expect(billing.incrementSpanCount).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid trace payload", async () => {
    mockApiKey();

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer sk-test-key", "content-type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/traces — list traces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without API key", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/traces" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for invalid API key", async () => {
    vi.mocked(db.resolveApiKey).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces",
      headers: { authorization: "Bearer invalid-key" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns paginated traces for authenticated org", async () => {
    mockApiKey("org_1");
    vi.mocked(db.queryTraces).mockResolvedValue([]);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces?page=1&limit=10",
      headers: { authorization: "Bearer sk-test-key" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body.pagination).toMatchObject({ page: 1, limit: 10 });
    expect(vi.mocked(db.queryTraces)).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org_1", page: 1, limit: 10 }),
    );
  });

  it("rejects limit above 100", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces?limit=999",
      headers: { authorization: "Bearer sk-test-key" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("passes agentId and sessionId filters to queryTraces", async () => {
    mockApiKey("org_1");
    vi.mocked(db.queryTraces).mockResolvedValue([]);
    const app = buildApp();
    await app.inject({
      method: "GET",
      url: "/v1/traces?agentId=agent_42&sessionId=sess_99",
      headers: { authorization: "Bearer sk-test-key" },
    });
    expect(vi.mocked(db.queryTraces)).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agent_42", sessionId: "sess_99" }),
    );
  });
});

describe("GET /v1/traces/:id — single trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when trace not found", async () => {
    mockApiKey();
    vi.mocked(db.getTraceWithSpans).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/trace_missing",
      headers: { authorization: "Bearer sk-test-key" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns trace scoped to authenticated org", async () => {
    mockApiKey("org_1");
    const mockTrace = {
      id: "trace_1",
      agentId: "agent_1",
      orgId: "org_1",
      sessionId: null,
      startTimeMs: Date.now(),
      endTimeMs: null,
      metadata: {},
      spans: [],
      createdAt: new Date(),
    };
    vi.mocked(db.getTraceWithSpans).mockResolvedValue(mockTrace as never);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/trace_1",
      headers: { authorization: "Bearer sk-test-key" },
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.getTraceWithSpans)).toHaveBeenCalledWith("trace_1", "org_1");
  });
});
