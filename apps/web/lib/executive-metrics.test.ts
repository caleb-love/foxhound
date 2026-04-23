import { describe, it, expect } from "vitest";
import { buildExecutiveMetricCards } from "./executive-metrics";

describe("buildExecutiveMetricCards", () => {
  it("derives executive metric cards from fleet metrics and ship-ready count", () => {
    const cards = buildExecutiveMetricCards(
      {
        healthPercent: 92,
        previousHealthPercent: 97,
        criticalRegressions: 2,
        previousCriticalRegressions: 0,
        slaRisks: 4,
        previousSlaRisks: 3,
        budgetOverspendUsd: 182,
        previousBudgetOverspendUsd: 90,
      },
      3,
      1,
    );

    expect(cards).toHaveLength(4);
    expect(cards[0]?.label).toBe("Reliability");
    expect(cards[0]?.sparklineData?.[0]?.value).toBe(97);
    expect(cards[0]?.sparklineData?.at(-1)?.value).toBe(92);

    expect(cards[1]?.label).toBe("Cost position");
    expect(cards[1]?.value).toBe("$182 over");
    expect(cards[1]?.sparklineData?.[0]?.value).toBe(90);
    expect(cards[1]?.sparklineData?.at(-1)?.value).toBe(182);

    expect(cards[2]?.label).toBe("Risk items");
    expect(cards[2]?.value).toBe("6 active");
    expect(cards[2]?.previousValue).toBe(3);

    expect(cards[3]?.label).toBe("Ready to ship");
    expect(cards[3]?.value).toBe("3");
    expect(cards[3]?.sparklineData?.[0]?.value).toBe(1);
    expect(cards[3]?.sparklineData?.at(-1)?.value).toBe(3);
  });

  it("shows on-budget and warning tone when there is no overspend", () => {
    const cards = buildExecutiveMetricCards(
      {
        healthPercent: 99,
        criticalRegressions: 0,
        slaRisks: 0,
        budgetOverspendUsd: 0,
      },
      0,
    );

    expect(cards[1]?.value).toBe("On budget");
    expect(cards[1]?.tone).toBe("healthy");
    expect(cards[3]?.tone).toBe("warning");
  });
});
