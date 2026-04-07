import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { tracesRoutes } from "../routes/traces.js";

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
}));

import * as db from "@foxhound/db";
import * as billing from "@foxhound/billing";

const FREE_ENTITLEMENTS = {
  canReplay: false,
  canRunDiff: false,
  canAuditLog: false,
  maxSpans: 10_000,
  maxProjects: 1,
  maxSeats: 1,
  retentionDays: 7,
};

const PRO_ENTITLEMENTS = {
  canReplay: true,
  canRunDiff: true,
  canAuditLog: false,
  maxSpans: 500_000,
  maxProjects: 10,
  maxSeats: 5,
  retentionDays: 90,
};

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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describe("GET /v1/traces/:traceId/spans/:spanId/replay — entitlement gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 upgrade_required for free-tier orgs", async () => {
    mockApiKey();
    vi.mocked(billing.getEntitlements).mockResolvedValue(FREE_ENTITLEMENTS);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/trace_1/spans/span_1/replay",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("upgrade_required");
    expect(body.feature).toBe("replay");
    expect(body.upgradeUrl).toBe("/pricing");
  });

  it("allows replay for pro-tier orgs", async () => {
    mockApiKey("org_pro");
    vi.mocked(billing.getEntitlements).mockResolvedValue(PRO_ENTITLEMENTS);
    vi.mocked(db.getReplayContext).mockResolvedValue({
      traceId: "trace_1",
      spanId: "span_1",
      targetSpan: {
        traceId: "trace_1",
        spanId: "span_1",
        name: "test",
        kind: "agent_step",
        startTimeMs: 0,
        status: "ok",
        attributes: {},
        events: [],
      },
      spansUpToPoint: [],
      llmCallHistory: [],
      toolCallHistory: [],
      agentStepHistory: [],
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/trace_1/spans/span_1/replay",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(200);
  });
});

describe("GET /v1/runs/diff — entitlement gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 upgrade_required for free-tier orgs", async () => {
    mockApiKey();
    vi.mocked(billing.getEntitlements).mockResolvedValue(FREE_ENTITLEMENTS);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/runs/diff?runA=trace_a&runB=trace_b",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("upgrade_required");
    expect(body.feature).toBe("run_diff");
    expect(body.upgradeUrl).toBe("/pricing");
  });

  it("allows diff for pro-tier orgs", async () => {
    mockApiKey("org_pro");
    vi.mocked(billing.getEntitlements).mockResolvedValue(PRO_ENTITLEMENTS);
    vi.mocked(db.diffTraces).mockResolvedValue({
      traceIdA: "trace_a",
      traceIdB: "trace_b",
      totalSpansA: 1,
      totalSpansB: 1,
      alignedSpans: [],
      divergenceCount: 0,
      summary: "Runs are identical.",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/runs/diff?runA=trace_a&runB=trace_b",
      headers: { authorization: "Bearer sk-test-key" },
    });

    expect(res.statusCode).toBe(200);
  });
});
