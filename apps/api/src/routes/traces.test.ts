import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { tracesRoutes } from "./traces.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  insertTrace: vi.fn(),
  queryTraces: vi.fn(),
  getTrace: vi.fn(),
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
  app.register(tracesRoutes);
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
