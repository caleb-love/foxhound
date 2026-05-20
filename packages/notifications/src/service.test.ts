import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAlertFiringService } from "./service.js";
import type {
  AlertEvent,
  AlertRule,
  NotificationChannel,
  SlackChannelConfig,
} from "./types.js";

function makeChannel(id: string, orgId = "org_1"): NotificationChannel {
  return {
    id,
    orgId,
    kind: "slack",
    name: "alerts",
    config: { webhookUrl: "https://hooks.slack.com/x" } as SlackChannelConfig,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule_1",
    orgId: "org_1",
    eventType: "agent_failure",
    minSeverity: "low",
    channelId: "chan_1",
    enabled: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    type: "agent_failure",
    severity: "high",
    orgId: "org_1",
    agentId: "agent_a",
    traceId: "trace_1",
    message: "boom",
    metadata: {},
    occurredAt: new Date(0),
    ...overrides,
  };
}

interface Deps {
  getAlertRulesForOrg: ReturnType<typeof vi.fn>;
  listNotificationChannels: ReturnType<typeof vi.fn>;
  createNotificationLogEntry: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
}

function makeDeps(): Deps {
  return {
    getAlertRulesForOrg: vi.fn(),
    listNotificationChannels: vi.fn(),
    createNotificationLogEntry: vi.fn(),
    dispatch: vi.fn(async () => {}),
  };
}

describe("AlertFiringService", () => {
  let deps: Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("fetches rules + channels scoped to event.orgId", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([]);
    deps.listNotificationChannels.mockResolvedValue([]);
    const svc = createAlertFiringService(deps);

    await svc.fireEvent(makeEvent({ orgId: "org_42" }));

    expect(deps.getAlertRulesForOrg).toHaveBeenCalledWith("org_42");
    expect(deps.listNotificationChannels).toHaveBeenCalledWith({ orgId: "org_42" });
  });

  it("returns zero result when no rules match the event type", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([makeRule({ eventType: "cost_spike" })]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    const svc = createAlertFiringService(deps);

    const result = await svc.fireEvent(makeEvent({ type: "agent_failure" }));
    expect(result.matchedRuleCount).toBe(0);
    expect(result.dispatched).toBe(0);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("drops rules whose channel is missing", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([
      makeRule({ id: "r_a", channelId: "chan_1" }),
      makeRule({ id: "r_b", channelId: "chan_missing" }),
    ]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    deps.createNotificationLogEntry.mockResolvedValue({ id: "log_1" });
    const svc = createAlertFiringService(deps);

    const result = await svc.fireEvent(makeEvent());
    expect(result.eligibleRuleCount).toBe(1);
    expect(deps.dispatch).toHaveBeenCalledTimes(1);
    const [, eligible] = deps.dispatch.mock.calls[0]!;
    expect((eligible as AlertRule[]).map((r) => r.id)).toEqual(["r_a"]);
  });

  it("writes notification log entries post-dispatch when no dedupeKey", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([makeRule()]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    deps.createNotificationLogEntry.mockResolvedValue({ id: "log_1" });
    const svc = createAlertFiringService(deps);

    await svc.fireEvent(makeEvent());

    expect(deps.dispatch).toHaveBeenCalledTimes(1);
    expect(deps.createNotificationLogEntry).toHaveBeenCalledTimes(1);
    const entry = deps.createNotificationLogEntry.mock.calls[0]![0];
    expect(entry).toMatchObject({
      orgId: "org_1",
      ruleId: "rule_1",
      channelId: "chan_1",
      eventType: "agent_failure",
      severity: "high",
      agentId: "agent_a",
      traceId: "trace_1",
      status: "sent",
    });
    expect(entry).not.toHaveProperty("dedupeKey");
  });

  it("dedupes pre-dispatch when a dedupeKey is provided", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([
      makeRule({ id: "r_a", channelId: "chan_1" }),
      makeRule({ id: "r_b", channelId: "chan_1" }),
    ]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    // First rule's log entry inserts, second rule is a duplicate.
    deps.createNotificationLogEntry
      .mockResolvedValueOnce({ id: "log_a" })
      .mockResolvedValueOnce(null);
    const svc = createAlertFiringService(deps);

    const result = await svc.fireEvent(makeEvent(), { dedupeKey: "cost:org_1:agent_a:bucket42" });

    expect(result.eligibleRuleCount).toBe(1);
    expect(deps.dispatch).toHaveBeenCalledTimes(1);
    const [, eligible] = deps.dispatch.mock.calls[0]!;
    expect((eligible as AlertRule[]).map((r) => r.id)).toEqual(["r_a"]);

    // dedupeKey is composed with rule id so two rules can't collide
    const keys = deps.createNotificationLogEntry.mock.calls.map((c) => c[0].dedupeKey);
    expect(keys).toEqual(["cost:org_1:agent_a:bucket42:r_a", "cost:org_1:agent_a:bucket42:r_b"]);
  });

  it("does not call dispatch when every matching rule is deduped out", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([makeRule()]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    deps.createNotificationLogEntry.mockResolvedValue(null);
    const svc = createAlertFiringService(deps);

    const result = await svc.fireEvent(makeEvent(), { dedupeKey: "x" });
    expect(result.dispatched).toBe(0);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("invokes onMatchedRules with the matched-by-event-type set before dispatch", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([
      makeRule({ id: "r_a" }),
      makeRule({ id: "r_b", eventType: "cost_spike" }),
    ]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    deps.createNotificationLogEntry.mockResolvedValue({ id: "log_a" });

    const onMatched = vi.fn();
    const svc = createAlertFiringService(deps);

    await svc.fireEvent(makeEvent(), { onMatchedRules: onMatched });

    expect(onMatched).toHaveBeenCalledTimes(1);
    const matched = onMatched.mock.calls[0]![0] as AlertRule[];
    expect(matched.map((r) => r.id)).toEqual(["r_a"]);
  });

  it("does not throw when dispatch fails — caller-side decision", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([makeRule()]);
    deps.listNotificationChannels.mockResolvedValue([makeChannel("chan_1")]);
    deps.createNotificationLogEntry.mockResolvedValue({ id: "log_1" });
    deps.dispatch.mockRejectedValueOnce(new Error("slack down"));
    const svc = createAlertFiringService(deps);

    await expect(svc.fireEvent(makeEvent())).rejects.toThrow("slack down");
  });

  it("tenant scope: never queries rules for a different org than the event", async () => {
    deps.getAlertRulesForOrg.mockResolvedValue([]);
    deps.listNotificationChannels.mockResolvedValue([]);
    const svc = createAlertFiringService(deps);

    await svc.fireEvent(makeEvent({ orgId: "org_alpha" }));
    await svc.fireEvent(makeEvent({ orgId: "org_beta" }));

    expect(deps.getAlertRulesForOrg.mock.calls.map((c) => c[0])).toEqual(["org_alpha", "org_beta"]);
    expect(deps.listNotificationChannels.mock.calls.map((c) => c[0].orgId)).toEqual([
      "org_alpha",
      "org_beta",
    ]);
  });
});
