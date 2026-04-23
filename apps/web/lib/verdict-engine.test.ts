import { describe, it, expect } from "vitest";
import {
  computeFleetVerdict,
  computeExecutiveVerdict,
  computeDelta,
  type FleetMetrics,
} from "./verdict-engine";

// ---------------------------------------------------------------------------
// computeFleetVerdict
// ---------------------------------------------------------------------------

describe("computeFleetVerdict", () => {
  it("returns critical severity when critical regressions exist", () => {
    const metrics: FleetMetrics = {
      healthPercent: 92,
      criticalRegressions: 2,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.severity).toBe("critical");
    expect(verdict.headline).toContain("2 critical regressions");
    expect(verdict.headline).toContain("need investigation");
  });

  it("returns critical severity when both regressions and SLA risks exist", () => {
    const metrics: FleetMetrics = {
      healthPercent: 85,
      criticalRegressions: 1,
      slaRisks: 3,
      budgetOverspendUsd: 200,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.severity).toBe("critical");
    expect(verdict.headline).toContain("1 critical regression");
    expect(verdict.headline).toContain("3 SLA risks");
  });

  it("returns warning severity for SLA risks without regressions", () => {
    const metrics: FleetMetrics = {
      healthPercent: 95,
      criticalRegressions: 0,
      slaRisks: 2,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.severity).toBe("warning");
    expect(verdict.headline).toContain("healthy with active risks");
  });

  it("returns warning severity for budget overspend alone", () => {
    const metrics: FleetMetrics = {
      healthPercent: 98,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 50,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.severity).toBe("warning");
  });

  it("returns healthy severity when everything is fine", () => {
    const metrics: FleetMetrics = {
      healthPercent: 99,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.severity).toBe("healthy");
    expect(verdict.headline).toBe("Fleet healthy, no action required");
  });

  it("builds narrative with health trend when previous value exists", () => {
    const metrics: FleetMetrics = {
      healthPercent: 92,
      previousHealthPercent: 97,
      criticalRegressions: 1,
      slaRisks: 0,
      budgetOverspendUsd: 182,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.narrative).toContain("down from 97%");
    expect(verdict.narrative).toContain("1 critical regression");
    expect(verdict.narrative).toContain("$182 projected overspend");
  });

  it("builds narrative for improving health", () => {
    const metrics: FleetMetrics = {
      healthPercent: 97,
      previousHealthPercent: 92,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.narrative).toContain("up from 92%");
    expect(verdict.narrative).toContain("Budget is on track");
  });

  it("builds narrative for flat health", () => {
    const metrics: FleetMetrics = {
      healthPercent: 95,
      previousHealthPercent: 95,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.narrative).toContain("holding at 95%");
  });

  it("generates regression investigation action", () => {
    const metrics: FleetMetrics = {
      healthPercent: 88,
      criticalRegressions: 3,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.actions).toContainEqual({
      label: "Investigate regressions",
      href: "/regressions",
    });
  });

  it("generates SLA review action", () => {
    const metrics: FleetMetrics = {
      healthPercent: 90,
      criticalRegressions: 0,
      slaRisks: 4,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.actions).toContainEqual({ label: "Review SLA risks", href: "/slas" });
  });

  it("generates budget action for overspend", () => {
    const metrics: FleetMetrics = {
      healthPercent: 95,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 300,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.actions).toContainEqual({ label: "Open budgets", href: "/budgets" });
  });

  it("generates default traces action when healthy", () => {
    const metrics: FleetMetrics = {
      healthPercent: 99,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.actions).toContainEqual({ label: "View traces", href: "/traces" });
  });

  it("generates multiple actions for compound issues", () => {
    const metrics: FleetMetrics = {
      healthPercent: 85,
      criticalRegressions: 2,
      slaRisks: 3,
      budgetOverspendUsd: 500,
    };
    const verdict = computeFleetVerdict(metrics);
    expect(verdict.actions.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeExecutiveVerdict
// ---------------------------------------------------------------------------

describe("computeExecutiveVerdict", () => {
  it("returns red RAG for regressions with SLA risks", () => {
    const metrics: FleetMetrics = {
      healthPercent: 80,
      criticalRegressions: 2,
      slaRisks: 3,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.rag).toBe("red");
    expect(verdict.headline).toContain("Critical");
  });

  it("returns amber RAG for regressions without SLA risks", () => {
    const metrics: FleetMetrics = {
      healthPercent: 92,
      criticalRegressions: 1,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.rag).toBe("amber");
    expect(verdict.headline).toContain("healthy");
  });

  it("returns amber RAG for SLA risks without regressions", () => {
    const metrics: FleetMetrics = {
      healthPercent: 93,
      criticalRegressions: 0,
      slaRisks: 2,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.rag).toBe("amber");
  });

  it("returns amber RAG for minor budget overspend", () => {
    const metrics: FleetMetrics = {
      healthPercent: 98,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 100,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.rag).toBe("amber");
  });

  it("returns green RAG when everything is healthy", () => {
    const metrics: FleetMetrics = {
      healthPercent: 99,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.rag).toBe("green");
    expect(verdict.headline).toContain("no action required");
  });

  it("builds subheadline with trend when previous data exists", () => {
    const metrics: FleetMetrics = {
      healthPercent: 92,
      previousHealthPercent: 97,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.subheadline).toContain("down 5pp");
  });

  it("builds subheadline without trend when no previous data", () => {
    const metrics: FleetMetrics = {
      healthPercent: 95,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };
    const verdict = computeExecutiveVerdict(metrics);
    expect(verdict.subheadline).toContain("95% reliability");
  });
});

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

describe("computeDelta", () => {
  it("returns null when previous is undefined", () => {
    expect(computeDelta(92, undefined, true)).toBeNull();
  });

  it("returns flat when values are equal", () => {
    const delta = computeDelta(92, 92, true);
    expect(delta?.direction).toBe("flat");
    expect(delta?.isRegression).toBe(false);
  });

  it("returns up direction for increase", () => {
    const delta = computeDelta(97, 92, true);
    expect(delta?.direction).toBe("up");
    expect(delta?.label).toBe("+5pp");
    expect(delta?.isRegression).toBe(false);
  });

  it("returns down direction for decrease", () => {
    const delta = computeDelta(90, 95, true);
    expect(delta?.direction).toBe("down");
    expect(delta?.label).toBe("-5pp");
    expect(delta?.isRegression).toBe(true);
  });

  it("treats increase as regression when higher is worse", () => {
    const delta = computeDelta(5, 2, false);
    expect(delta?.direction).toBe("up");
    expect(delta?.isRegression).toBe(true);
  });

  it("treats decrease as improvement when higher is worse", () => {
    const delta = computeDelta(2, 5, false);
    expect(delta?.direction).toBe("down");
    expect(delta?.isRegression).toBe(false);
  });

  it("formats large non-percentage values correctly", () => {
    const delta = computeDelta(500, 200, false);
    expect(delta?.label).toBe("+300");
  });
});
