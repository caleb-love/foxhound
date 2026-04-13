import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlertEvent, AlertRule, NotificationChannel } from "./types.js";
import { SEVERITY_RANK } from "./types.js";

// ---------------------------------------------------------------------------
// Stable send mocks — declared via vi.hoisted() so they exist before the
// hoisted vi.mock factory runs and before dispatcher.ts calls `new XxxProvider()`.
// ---------------------------------------------------------------------------

const {
  slackSend,
  pagerdutySend,
  githubSend,
  linearSend,
  webhookSend,
} = vi.hoisted(() => ({
  slackSend: vi.fn().mockResolvedValue(undefined),
  pagerdutySend: vi.fn().mockResolvedValue(undefined),
  githubSend: vi.fn().mockResolvedValue(undefined),
  linearSend: vi.fn().mockResolvedValue(undefined),
  webhookSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./providers/index.js", () => ({
  SlackProvider: vi.fn().mockImplementation(() => ({
    kind: "slack",
    send: slackSend,
  })),
  PagerDutyProvider: vi.fn().mockImplementation(() => ({
    kind: "pagerduty",
    send: pagerdutySend,
  })),
  GitHubProvider: vi.fn().mockImplementation(() => ({
    kind: "github",
    send: githubSend,
  })),
  LinearProvider: vi.fn().mockImplementation(() => ({
    kind: "linear",
    send: linearSend,
  })),
  WebhookProvider: vi.fn().mockImplementation(() => ({
    kind: "webhook",
    send: webhookSend,
  })),
}));

import { dispatchAlert } from "./dispatcher.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    type: "cost_budget_exceeded",
    severity: "high",
    orgId: "org_1",
    agentId: "agent_1",
    message: "Budget exceeded for agent_1",
    metadata: {},
    occurredAt: now,
    ...overrides,
  };
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule_1",
    orgId: "org_1",
    eventType: "cost_budget_exceeded",
    minSeverity: "medium",
    channelId: "ch_1",
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<NotificationChannel> = {}): NotificationChannel {
  return {
    id: "ch_1",
    orgId: "org_1",
    kind: "slack",
    name: "Slack Alerts",
    config: { webhookUrl: "https://hooks.slack.com/test" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeLogger() {
  return { error: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatchAlert", () => {
  it("dispatches to matching rule's channel", async () => {
    const event = makeEvent();
    const rules = [makeRule()];
    const channel = makeChannel();
    const channels = new Map([["ch_1", channel]]);

    await dispatchAlert(event, rules, channels);

    expect(slackSend).toHaveBeenCalledWith(event, channel);
  });

  it("filters out disabled rules", async () => {
    const event = makeEvent();
    const rules = [makeRule({ enabled: false })];
    const channel = makeChannel();
    const channels = new Map([["ch_1", channel]]);

    await dispatchAlert(event, rules, channels);

    expect(slackSend).not.toHaveBeenCalled();
  });

  it("filters by event type", async () => {
    const event = makeEvent({ type: "sla_duration_breach" });
    const rules = [makeRule({ eventType: "cost_budget_exceeded" })];
    const channels = new Map([["ch_1", makeChannel()]]);

    await dispatchAlert(event, rules, channels);

    expect(slackSend).not.toHaveBeenCalled();
  });

  it("filters by severity (only dispatches if event severity >= rule minSeverity)", async () => {
    // Rule requires "high" (rank 2), event is "medium" (rank 1) — should NOT match
    const event = makeEvent({ severity: "medium" });
    const rules = [makeRule({ minSeverity: "high" })];
    const channels = new Map([["ch_1", makeChannel()]]);

    await dispatchAlert(event, rules, channels);

    expect(slackSend).not.toHaveBeenCalled();

    // Verify the severity ranks used for filtering are correct
    expect(SEVERITY_RANK["medium"]).toBeLessThan(SEVERITY_RANK["high"]);
  });

  it("logs error when channel not found for a rule", async () => {
    const event = makeEvent();
    const rules = [makeRule({ channelId: "ch_missing" })];
    const channels = new Map<string, NotificationChannel>();
    const logger = makeLogger();

    await dispatchAlert(event, rules, channels, logger);

    expect(logger.error).toHaveBeenCalledWith(
      { ruleId: "rule_1", channelId: "ch_missing" },
      "Channel not found for rule",
    );
  });

  it("logs error when no provider for channel kind", async () => {
    const event = makeEvent();
    const rules = [makeRule()];
    // Channel with an unregistered kind
    const channel = makeChannel({ kind: "carrier_pigeon" as NotificationChannel["kind"] });
    const channels = new Map([["ch_1", channel]]);
    const logger = makeLogger();

    await dispatchAlert(event, rules, channels, logger);

    expect(logger.error).toHaveBeenCalledWith(
      { channelKind: "carrier_pigeon" },
      "No provider registered for channel kind",
    );
  });

  it("handles provider.send failure gracefully (does not throw)", async () => {
    slackSend.mockRejectedValueOnce(new Error("Slack API down"));

    const event = makeEvent();
    const rules = [makeRule()];
    const channels = new Map([["ch_1", makeChannel()]]);
    const logger = makeLogger();

    // Should not throw even though provider.send rejects
    await expect(dispatchAlert(event, rules, channels, logger)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        ruleId: "rule_1",
        channelId: "ch_1",
        eventType: "cost_budget_exceeded",
      }),
      "Failed to send notification",
    );
  });

  it("dispatches to multiple channels when multiple rules match", async () => {
    const event = makeEvent({ severity: "critical" });
    const slackChannel = makeChannel({ id: "ch_slack", kind: "slack" });
    const pagerChannel = makeChannel({
      id: "ch_pager",
      kind: "pagerduty",
      config: { integrationKey: "pd-key-123" },
    });
    const rules = [
      makeRule({ id: "rule_slack", channelId: "ch_slack", minSeverity: "low" }),
      makeRule({ id: "rule_pager", channelId: "ch_pager", minSeverity: "high" }),
    ];
    const channels = new Map([
      ["ch_slack", slackChannel],
      ["ch_pager", pagerChannel],
    ]);

    await dispatchAlert(event, rules, channels);

    expect(slackSend).toHaveBeenCalledWith(event, slackChannel);
    expect(pagerdutySend).toHaveBeenCalledWith(event, pagerChannel);
  });

  it("calls nothing when no rules match", async () => {
    const event = makeEvent({ type: "behavior_regression" });
    // All rules target a different event type
    const rules = [makeRule({ eventType: "cost_budget_exceeded" })];
    const channels = new Map([["ch_1", makeChannel()]]);
    const logger = makeLogger();

    await dispatchAlert(event, rules, channels, logger);

    expect(slackSend).not.toHaveBeenCalled();
    expect(pagerdutySend).not.toHaveBeenCalled();
    expect(githubSend).not.toHaveBeenCalled();
    expect(linearSend).not.toHaveBeenCalled();
    expect(webhookSend).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
