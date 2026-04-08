import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlertEvent, NotificationChannel } from "../types.js";
import { PagerDutyProvider } from "./pagerduty.js";
import { GitHubProvider } from "./github.js";
import { LinearProvider } from "./linear.js";
import { WebhookProvider } from "./webhook.js";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    type: "agent_failure",
    severity: "critical",
    orgId: "org-123",
    agentId: "agent-abc",
    traceId: "trace-xyz",
    sessionId: "session-1",
    message: "Agent exploded mid-task",
    metadata: { spanCount: 42 },
    occurredAt: new Date("2024-06-01T12:00:00.000Z"),
    ...overrides,
  };
}

function makeChannel(
  kind: NotificationChannel["kind"],
  config: NotificationChannel["config"],
): NotificationChannel {
  return {
    id: "ch-1",
    orgId: "org-123",
    kind,
    name: "Test channel",
    config,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Helper to safely get first mock call args
function firstCall(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("fetch was not called");
  return call as [string, RequestInit];
}

function parsedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = firstCall(fetchMock);
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const [, init] = firstCall(fetchMock);
  return init.headers as Record<string, string>;
}

// ---------------------------------------------------------------------------
// PagerDuty
// ---------------------------------------------------------------------------

describe("PagerDutyProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "OK" });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a trigger event with correct routing key and severity", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", {
      integrationKey: "test-routing-key",
      dashboardBaseUrl: "https://foxhound.example.com",
    });

    await provider.send(makeEvent(), channel);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = firstCall(fetchMock);
    const body = parsedBody(fetchMock);
    expect(url).toContain("pagerduty.com");
    expect(body["routing_key"]).toBe("test-routing-key");
    expect(body["event_action"]).toBe("trigger");
    const payload = body["payload"] as Record<string, unknown>;
    expect(payload["severity"]).toBe("critical");
    expect(String(payload["summary"])).toContain("agent_failure");
  });

  it("maps high severity to 'error'", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", { integrationKey: "key" });
    await provider.send(makeEvent({ severity: "high" }), channel);
    const payload = parsedBody(fetchMock)["payload"] as Record<string, unknown>;
    expect(payload["severity"]).toBe("error");
  });

  it("maps medium severity to 'warning'", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", { integrationKey: "key" });
    await provider.send(makeEvent({ severity: "medium" }), channel);
    const payload = parsedBody(fetchMock)["payload"] as Record<string, unknown>;
    expect(payload["severity"]).toBe("warning");
  });

  it("maps low severity to 'info'", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", { integrationKey: "key" });
    await provider.send(makeEvent({ severity: "low" }), channel);
    const payload = parsedBody(fetchMock)["payload"] as Record<string, unknown>;
    expect(payload["severity"]).toBe("info");
  });

  it("includes trace link in links array when dashboardBaseUrl is set", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", {
      integrationKey: "key",
      dashboardBaseUrl: "https://fox.example.com",
    });
    await provider.send(makeEvent({ traceId: "trace-xyz" }), channel);
    const links = parsedBody(fetchMock)["links"] as Array<{ href: string }>;
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toContain("trace-xyz");
  });

  it("uses traceId in dedup_key when provided", async () => {
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", { integrationKey: "key" });
    await provider.send(makeEvent({ traceId: "t-001" }), channel);
    expect(String(parsedBody(fetchMock)["dedup_key"])).toContain("t-001");
  });

  it("throws when PagerDuty API returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "Bad key" });
    const provider = new PagerDutyProvider();
    const channel = makeChannel("pagerduty", { integrationKey: "bad" });
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("400");
  });

  it("resolve() sends a resolve event with the dedup key", async () => {
    const provider = new PagerDutyProvider();
    await provider.resolve("my-dedup-key", { integrationKey: "key" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = parsedBody(fetchMock);
    expect(body["event_action"]).toBe("resolve");
    expect(body["dedup_key"]).toBe("my-dedup-key");
  });

  it("has kind 'pagerduty'", () => {
    expect(new PagerDutyProvider().kind).toBe("pagerduty");
  });
});

// ---------------------------------------------------------------------------
// GitHub Issues
// ---------------------------------------------------------------------------

describe("GitHubProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an issue with correct title containing event type", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "ghp_test", repo: "owner/repo" });
    await provider.send(makeEvent(), channel);
    const body = parsedBody(fetchMock);
    expect(String(body["title"])).toContain("Agent Failure");
    expect(String(body["title"])).toContain("Foxhound");
  });

  it("sets Authorization header with Bearer token", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "ghp_secret", repo: "a/b" });
    await provider.send(makeEvent(), channel);
    expect(sentHeaders(fetchMock)["Authorization"]).toBe("Bearer ghp_secret");
  });

  it("hits the correct GitHub API endpoint for the repo", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "tok", repo: "acme/alerts" });
    await provider.send(makeEvent(), channel);
    const [url] = firstCall(fetchMock);
    expect(url).toContain("repos/acme/alerts/issues");
  });

  it("includes labels when configured", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "tok", repo: "a/b", labels: ["foxhound", "bug"] });
    await provider.send(makeEvent(), channel);
    expect(parsedBody(fetchMock)["labels"]).toEqual(["foxhound", "bug"]);
  });

  it("omits labels field when not configured", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "tok", repo: "a/b" });
    await provider.send(makeEvent(), channel);
    expect(parsedBody(fetchMock)["labels"]).toBeUndefined();
  });

  it("includes trace link in body when dashboardBaseUrl is set", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", {
      token: "tok",
      repo: "a/b",
      dashboardBaseUrl: "https://fox.example.com",
    });
    await provider.send(makeEvent({ traceId: "trace-999" }), channel);
    const body = parsedBody(fetchMock);
    expect(String(body["body"])).toContain("trace-999");
    expect(String(body["body"])).toContain("fox.example.com");
  });

  it("includes metadata in issue body", async () => {
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "tok", repo: "a/b" });
    await provider.send(makeEvent({ metadata: { commitSha: "abc123" } }), channel);
    expect(String(parsedBody(fetchMock)["body"])).toContain("commitSha");
  });

  it("throws when GitHub API returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => "Forbidden" });
    const provider = new GitHubProvider();
    const channel = makeChannel("github", { token: "bad", repo: "a/b" });
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("403");
  });

  it("has kind 'github'", () => {
    expect(new GitHubProvider().kind).toBe("github");
  });
});

// ---------------------------------------------------------------------------
// Linear
// ---------------------------------------------------------------------------

describe("LinearProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { issueCreate: { success: true, issue: { id: "i-1", identifier: "FOO-1", url: "https://linear.app" } } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a GraphQL mutation to the Linear API", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "lin_api_key", teamId: "team-abc" });
    await provider.send(makeEvent(), channel);
    const [url] = firstCall(fetchMock);
    expect(url).toContain("linear.app/graphql");
    const body = parsedBody(fetchMock);
    expect(String(body["query"])).toContain("issueCreate");
    const vars = body["variables"] as Record<string, Record<string, unknown>>;
    expect(vars["input"]?.["teamId"]).toBe("team-abc");
  });

  it("sets Authorization header with API key", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "my-lin-key", teamId: "team-1" });
    await provider.send(makeEvent(), channel);
    expect(sentHeaders(fetchMock)["Authorization"]).toBe("my-lin-key");
  });

  it("maps critical severity to Linear priority 1 (Urgent)", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await provider.send(makeEvent({ severity: "critical" }), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(vars["input"]?.["priority"]).toBe(1);
  });

  it("maps low severity to Linear priority 4", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await provider.send(makeEvent({ severity: "low" }), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(vars["input"]?.["priority"]).toBe(4);
  });

  it("includes projectId when configured", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t", projectId: "proj-xyz" });
    await provider.send(makeEvent(), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(vars["input"]?.["projectId"]).toBe("proj-xyz");
  });

  it("omits projectId when not configured", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await provider.send(makeEvent(), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(vars["input"]?.["projectId"]).toBeUndefined();
  });

  it("includes investigation steps in description", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await provider.send(makeEvent(), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(String(vars["input"]?.["description"])).toContain("Investigation Steps");
  });

  it("includes trace link in description when dashboardBaseUrl set", async () => {
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t", dashboardBaseUrl: "https://fox.example.com" });
    await provider.send(makeEvent({ traceId: "trace-abc" }), channel);
    const vars = parsedBody(fetchMock)["variables"] as Record<string, Record<string, unknown>>;
    expect(String(vars["input"]?.["description"])).toContain("trace-abc");
    expect(String(vars["input"]?.["description"])).toContain("fox.example.com");
  });

  it("throws when Linear API returns GraphQL errors", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: "Unauthorized" }] }),
    });
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "bad", teamId: "t" });
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("Unauthorized");
  });

  it("throws when success=false", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { issueCreate: { success: false } } }),
    });
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("success=false");
  });

  it("throws when HTTP response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "Server error" });
    const provider = new LinearProvider();
    const channel = makeChannel("linear", { apiKey: "k", teamId: "t" });
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("500");
  });

  it("has kind 'linear'", () => {
    expect(new LinearProvider().kind).toBe("linear");
  });
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

describe("WebhookProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends a POST to the configured webhook URL", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://hooks.example.com/fox", secret: "s3cr3t" });
    await provider.send(makeEvent(), channel);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = firstCall(fetchMock);
    expect(url).toBe("https://hooks.example.com/fox");
    expect(init.method).toBe("POST");
  });

  it("includes HMAC-SHA256 signature header", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "mysecret" });
    await provider.send(makeEvent(), channel);
    expect(sentHeaders(fetchMock)["X-Foxhound-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("signature is valid HMAC-SHA256 of the request body", async () => {
    const { createHmac } = await import("node:crypto");
    const provider = new WebhookProvider();
    const secret = "verification-secret";
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret });
    await provider.send(makeEvent(), channel);
    const [, init] = firstCall(fetchMock);
    const sentBody = init.body as string;
    const expectedSig = createHmac("sha256", secret).update(sentBody).digest("hex");
    expect(sentHeaders(fetchMock)["X-Foxhound-Signature"]).toBe(`sha256=${expectedSig}`);
  });

  it("includes X-Foxhound-Event header with event type", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "s" });
    await provider.send(makeEvent({ type: "compliance_violation" }), channel);
    expect(sentHeaders(fetchMock)["X-Foxhound-Event"]).toBe("compliance_violation");
  });

  it("includes custom headers from config", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", {
      url: "https://h.example.com",
      secret: "s",
      headers: { "X-Custom-Header": "my-value" },
    });
    await provider.send(makeEvent(), channel);
    expect(sentHeaders(fetchMock)["X-Custom-Header"]).toBe("my-value");
  });

  it("payload contains event fields", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "s" });
    await provider.send(makeEvent(), channel);
    const body = parsedBody(fetchMock);
    expect(body["event"]).toBe("agent_failure");
    expect(body["severity"]).toBe("critical");
    expect(body["orgId"]).toBe("org-123");
    expect(body["agentId"]).toBe("agent-abc");
    expect(body["traceId"]).toBe("trace-xyz");
    expect(body["sessionId"]).toBe("session-1");
    expect(body["message"]).toBe("Agent exploded mid-task");
    expect(body["occurredAt"]).toBe("2024-06-01T12:00:00.000Z");
  });

  it("includes traceUrl when dashboardBaseUrl is configured", async () => {
    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", {
      url: "https://h.example.com",
      secret: "s",
      dashboardBaseUrl: "https://fox.example.com",
    });
    await provider.send(makeEvent({ traceId: "trace-777" }), channel);
    expect(parsedBody(fetchMock)["traceUrl"]).toBe("https://fox.example.com/traces/trace-777");
  });

  it("retries on 5xx error and succeeds on second attempt", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable" })
      .mockResolvedValue({ ok: true, text: async () => "" });

    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "s" });
    const sendPromise = provider.send(makeEvent(), channel);
    await vi.runAllTimersAsync();
    await sendPromise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on network error up to 3 total attempts", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue({ ok: true, text: async () => "" });

    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "s" });
    const sendPromise = provider.send(makeEvent(), channel);
    await vi.runAllTimersAsync();
    await sendPromise;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retries", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => "down" });

    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "s" });
    const sendPromise = provider.send(makeEvent(), channel);
    // Suppress unhandled rejection warning while timers advance
    void sendPromise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(sendPromise).rejects.toThrow();
    // 1 initial + 3 retries = 4 total
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry on 4xx client errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" });

    const provider = new WebhookProvider();
    const channel = makeChannel("webhook", { url: "https://h.example.com", secret: "bad-secret" });
    // 4xx fails immediately — no timer advance needed
    await expect(provider.send(makeEvent(), channel)).rejects.toThrow("401");
    // Only 1 attempt — no retry on 4xx
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("has kind 'webhook'", () => {
    expect(new WebhookProvider().kind).toBe("webhook");
  });
});
