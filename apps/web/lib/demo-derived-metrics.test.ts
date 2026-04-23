import { describe, it, expect } from "vitest";
import { buildLocalReviewDemo } from "@foxhound/demo-domain";
import { buildSandboxFleetMetrics } from "./demo-derived-metrics";

describe("buildSandboxFleetMetrics", () => {
  it("derives fleet metrics from the seeded local review demo", () => {
    const demo = buildLocalReviewDemo();
    const metrics = buildSandboxFleetMetrics(demo);

    expect(metrics.healthPercent).toBeGreaterThan(0);
    expect(metrics.healthPercent).toBeLessThanOrEqual(100);
    expect(metrics.previousHealthPercent).toBeGreaterThanOrEqual(metrics.healthPercent);
    expect(metrics.criticalRegressions).toBe(
      demo.regressions.filter((item) => item.severity === "critical").length,
    );
    expect(metrics.slaRisks).toBe(demo.slas.filter((item) => item.status !== "healthy").length);
    expect(metrics.budgetOverspendUsd).toBeGreaterThan(0);
  });
});
