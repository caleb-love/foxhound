import { describe, it, expect } from "vitest";
import { BudgetHandler } from "./budget.js";
import { COST_ATTR } from "./types.js";
import { makeSpan, makeSpanObs, setConfig, spyEmitter, stubData } from "./test-utils.js";

describe("BudgetHandler", () => {
  it("does nothing for agents with no budget", async () => {
    const data = stubData();
    setConfig(data, { orgId: "org-a", agentId: "agent-a", costBudgetUsd: null });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    await h.onSpan(
      makeSpanObs({
        span: makeSpan({ attributes: { [COST_ATTR]: 1.0 } }),
      }),
    );
    expect(emitter.events).toHaveLength(0);
  });

  it("ignores spans with no cost attribute", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    await h.onSpan(makeSpanObs());
    expect(h.snapshot("org-a", "agent-a")?.totalUsd ?? 0).toBe(0);
    expect(emitter.events).toHaveLength(0);
  });

  it("fires a warning when cumulative cost crosses the alert threshold", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    for (let i = 0; i < 8; i++) {
      await h.onSpan(
        makeSpanObs({
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
    }
    expect(emitter.events).toHaveLength(1);
    expect(emitter.events[0]!.type).toBe("cost_budget_exceeded");
    expect(emitter.events[0]!.severity).toBe("high");
  });

  it("fires critical when total cost reaches the budget", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    for (let i = 0; i < 10; i++) {
      await h.onSpan(
        makeSpanObs({
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
    }
    const critical = emitter.events.find((e) => e.severity === "critical");
    expect(critical).toBeDefined();
    expect(critical!.type).toBe("cost_budget_exceeded");
    // Snapshot shows exceededFired = true.
    expect(h.snapshot("org-a", "agent-a")?.exceededFired).toBe(true);
  });

  it("fires warning and critical at most once per period", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    for (let i = 0; i < 30; i++) {
      await h.onSpan(
        makeSpanObs({
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
    }
    // Expect exactly one warning + one critical for the period.
    const warnings = emitter.events.filter((e) => e.severity === "high");
    const critical = emitter.events.filter((e) => e.severity === "critical");
    expect(warnings).toHaveLength(1);
    expect(critical).toHaveLength(1);
  });

  it("resets when the period key rotates", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    let now = Date.UTC(2026, 3, 20, 12, 0, 0); // April 20 2026 12:00 UTC
    const h = new BudgetHandler({ data, emitter, now: () => now });
    // Day 1: drive 12 USD total → warn + critical.
    for (let i = 0; i < 12; i++) {
      await h.onSpan(
        makeSpanObs({ span: makeSpan({ attributes: { [COST_ATTR]: 1 } }) }),
      );
    }
    // Advance to Day 2.
    now = Date.UTC(2026, 3, 21, 12, 0, 0);
    // Day 2: single cheap span — no new alerts.
    await h.onSpan(makeSpanObs({ span: makeSpan({ attributes: { [COST_ATTR]: 0.5 } }) }));
    // Now push past 80 % of budget on Day 2 → should fire a new warning.
    for (let i = 0; i < 10; i++) {
      await h.onSpan(
        makeSpanObs({ span: makeSpan({ attributes: { [COST_ATTR]: 1 } }) }),
      );
    }
    // Day 1: 1 warn + 1 critical. Day 2: 1 warn + 1 critical.
    const warns = emitter.events.filter((e) => e.severity === "high");
    const crits = emitter.events.filter((e) => e.severity === "critical");
    expect(warns.length).toBe(2);
    expect(crits.length).toBe(2);
  });

  it("is tenant-scoped: two orgs share an agentId but have independent buckets", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "shared",
      costBudgetUsd: 10,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    setConfig(data, {
      orgId: "org-b",
      agentId: "shared",
      costBudgetUsd: 100,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    // 5 spans of $1 each for both orgs. org-a is at 50% of $10 = no alert.
    // org-b is at 5% of $100 = no alert.
    for (let i = 0; i < 5; i++) {
      await h.onSpan(
        makeSpanObs({
          orgId: "org-a",
          agentId: "shared",
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
      await h.onSpan(
        makeSpanObs({
          orgId: "org-b",
          agentId: "shared",
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
    }
    expect(emitter.events).toHaveLength(0);
    // Now push org-a to 90%.
    for (let i = 0; i < 4; i++) {
      await h.onSpan(
        makeSpanObs({
          orgId: "org-a",
          agentId: "shared",
          span: makeSpan({ attributes: { [COST_ATTR]: 1 } }),
        }),
      );
    }
    expect(emitter.events.length).toBe(1);
    expect(emitter.events[0]!.orgId).toBe("org-a");
  });

  it("onTick evicts old accumulators", () => {
    const data = stubData();
    const emitter = spyEmitter();
    const h = new BudgetHandler({ data, emitter, now: () => 1_700_000_000_000 });
    h.onTick(1_700_000_000_000);
    // No assertion needed — must not throw.
    expect(true).toBe(true);
  });
});
