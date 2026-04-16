import { describe, it, expect } from 'vitest';
import { buildFleetMetricCards } from './overview-metrics';

describe('buildFleetMetricCards', () => {
  it('derives metric cards and sparkline endpoints from fleet metrics', () => {
    const cards = buildFleetMetricCards(
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
      {
        traces: '/traces',
        regressions: '/regressions',
        slas: '/slas',
        budgets: '/budgets',
      },
    );

    expect(cards).toHaveLength(4);
    expect(cards[0]?.label).toBe('Fleet health');
    expect(cards[0]?.sparklineData?.[0]?.value).toBe(97);
    expect(cards[0]?.sparklineData?.at(-1)?.value).toBe(92);

    expect(cards[1]?.label).toBe('Critical regressions');
    expect(cards[1]?.tone).toBe('critical');
    expect(cards[1]?.sparklineData?.[0]?.value).toBe(0);
    expect(cards[1]?.sparklineData?.at(-1)?.value).toBe(2);

    expect(cards[3]?.label).toBe('Overspend');
    expect(cards[3]?.value).toBe('$182');
    expect(cards[3]?.sparklineData?.[0]?.value).toBe(90);
    expect(cards[3]?.sparklineData?.at(-1)?.value).toBe(182);
  });

  it('handles missing previous values by anchoring the sparkline to the current value', () => {
    const cards = buildFleetMetricCards(
      {
        healthPercent: 88,
        criticalRegressions: 0,
        slaRisks: 1,
        budgetOverspendUsd: 0,
      },
      {
        traces: '/traces',
        regressions: '/regressions',
        slas: '/slas',
        budgets: '/budgets',
      },
    );

    expect(cards[0]?.sparklineData?.[0]?.value).toBe(88);
    expect(cards[0]?.sparklineData?.at(-1)?.value).toBe(88);
    expect(cards[3]?.sparklineData?.[0]?.value).toBe(0);
    expect(cards[3]?.sparklineData?.at(-1)?.value).toBe(0);
  });
});
