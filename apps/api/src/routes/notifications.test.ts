import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { notificationsRoutes } from "./notifications.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createNotificationChannel: vi.fn(),
  listNotificationChannels: vi.fn(),
  getNotificationChannel: vi.fn(),
  createAlertRule: vi.fn(),
  listAlertRules: vi.fn(),
  getAlertRulesForOrg: vi.fn(),
  createNotificationLogEntry: vi.fn(),
}));

vi.mock("@foxhound/notifications", () => ({
  dispatchAlert: vi.fn(),
}));

import * as db from "@foxhound/db";
import * as notifications from "@foxhound/notifications";

const ORG_ID = "org_test";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret";
  registerAuth(app);
  void app.register(notificationsRoutes);
  return app;
}

function mockApiKey(orgId = ORG_ID, scopes: string | null = null) {
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

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeChannel(id = "ch_1") {
  return {
    id,
    orgId: ORG_ID,
    kind: "slack" as const,
    name: "My Slack",
    config: { webhookUrl: "https://hooks.slack.com/services/TEST" },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRule(id = "rule_1", channelId = "ch_1") {
  return {
    id,
    orgId: ORG_ID,
    eventType: "agent_failure" as const,
    minSeverity: "high" as const,
    channelId,
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("POST /v1/notifications/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  it("creates a channel and returns 201 without exposing config", async () => {
    const channel = makeChannel();
    vi.mocked(db.createNotificationChannel).mockResolvedValue(channel);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/channels",
      headers: { authorization: "Bearer sk-test" },
      payload: {
        name: "My Slack",
        kind: "slack",
        config: { webhookUrl: "https://hooks.slack.com/services/TEST" },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body.id).toBe("ch_1");
    expect(body.kind).toBe("slack");
    // config must not be returned
    expect(body).not.toHaveProperty("config");
  });

  it("returns 400 for invalid payload", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/channels",
      headers: { authorization: "Bearer sk-test" },
      payload: { name: "x", kind: "slack", config: { webhookUrl: "not-a-url" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without auth header", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/v1/notifications/channels" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when api key lacks notifications:write scope", async () => {
    mockApiKey(ORG_ID, "notifications:read");

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/channels",
      headers: { authorization: "Bearer sk-test" },
      payload: {
        name: "My Slack",
        kind: "slack",
        config: { webhookUrl: "https://hooks.slack.com/services/TEST" },
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ message: string }>().message).toContain("notifications:write");
  });
});

describe("GET /v1/notifications/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  it("returns channel list", async () => {
    vi.mocked(db.listNotificationChannels).mockResolvedValue([makeChannel()]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/notifications/channels",
      headers: { authorization: "Bearer sk-test" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(body.data).toHaveLength(1);
    expect(vi.mocked(db.listNotificationChannels)).toHaveBeenCalledWith({
      orgId: ORG_ID,
      searchQuery: undefined,
      channelIds: undefined,
    });
  });

  it("accepts shared-style search and channelId filters without applying event-window semantics", async () => {
    vi.mocked(db.listNotificationChannels).mockResolvedValue([makeChannel()]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/notifications/channels?q=slack&channelId=ch_1&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers: { authorization: "Bearer sk-test" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listNotificationChannels)).toHaveBeenCalledWith({
      orgId: ORG_ID,
      searchQuery: "slack",
      channelIds: ["ch_1"],
    });
  });

  it("returns 403 when api key lacks notifications:read scope", async () => {
    mockApiKey(ORG_ID, "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/notifications/channels",
      headers: { authorization: "Bearer sk-test" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ message: string }>().message).toContain("notifications:read");
  });
});

describe("POST /v1/notifications/rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  it("creates a rule when channel belongs to org", async () => {
    vi.mocked(db.getNotificationChannel).mockResolvedValue(makeChannel());
    vi.mocked(db.createAlertRule).mockResolvedValue(makeRule());

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/rules",
      headers: { authorization: "Bearer sk-test" },
      payload: { eventType: "agent_failure", minSeverity: "high", channelId: "ch_1" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body.id).toBe("rule_1");
    expect(body.eventType).toBe("agent_failure");
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(db.getNotificationChannel).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/rules",
      headers: { authorization: "Bearer sk-test" },
      payload: { eventType: "agent_failure", channelId: "ch_missing" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for unknown eventType", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/rules",
      headers: { authorization: "Bearer sk-test" },
      payload: { eventType: "unknown_type", channelId: "ch_1" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/notifications/rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  it("returns rule list", async () => {
    vi.mocked(db.listAlertRules).mockResolvedValue([makeRule()]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/notifications/rules",
      headers: { authorization: "Bearer sk-test" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /v1/notifications/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  it("dispatches a test notification and returns 200", async () => {
    vi.mocked(db.getNotificationChannel).mockResolvedValue(makeChannel());
    vi.mocked(db.getAlertRulesForOrg).mockResolvedValue([]);
    vi.mocked(notifications.dispatchAlert).mockResolvedValue(undefined);
    vi.mocked(db.createNotificationLogEntry).mockResolvedValue({
      id: "log_1",
      orgId: ORG_ID,
      ruleId: null,
      channelId: "ch_1",
      eventType: "agent_failure",
      severity: "high",
      agentId: "test-agent",
      traceId: null,
      status: "sent",
      error: null,
      dedupeKey: null,
      sentAt: NOW,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/test",
      headers: { authorization: "Bearer sk-test" },
      payload: { channelId: "ch_1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(notifications.dispatchAlert).toHaveBeenCalledOnce();
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(db.getNotificationChannel).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/test",
      headers: { authorization: "Bearer sk-test" },
      payload: { channelId: "ch_missing" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 502 when dispatch throws", async () => {
    vi.mocked(db.getNotificationChannel).mockResolvedValue(makeChannel());
    vi.mocked(db.getAlertRulesForOrg).mockResolvedValue([]);
    vi.mocked(notifications.dispatchAlert).mockRejectedValue(new Error("Slack down"));
    vi.mocked(db.createNotificationLogEntry).mockResolvedValue({
      id: "log_err",
      orgId: ORG_ID,
      ruleId: null,
      channelId: "ch_1",
      eventType: "agent_failure",
      severity: "high",
      agentId: "test-agent",
      traceId: null,
      status: "failed",
      error: "Slack down",
      dedupeKey: null,
      sentAt: NOW,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/notifications/test",
      headers: { authorization: "Bearer sk-test" },
      payload: { channelId: "ch_1" },
    });

    expect(res.statusCode).toBe(502);
  });
});
