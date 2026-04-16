import { describe, it, expect } from 'vitest';
import {
  buildExecutiveDecisions,
  buildExecutiveTalkingPoints,
  buildFleetActionItems,
} from './overview-narrative';

describe('overview narrative derivation', () => {
  const metrics = {
    healthPercent: 92,
    previousHealthPercent: 97,
    criticalRegressions: 2,
    previousCriticalRegressions: 0,
    slaRisks: 4,
    previousSlaRisks: 3,
    budgetOverspendUsd: 182,
    previousBudgetOverspendUsd: 90,
  };

  it('derives fleet action items from route-level metrics', () => {
    const items = buildFleetActionItems(metrics, {
      traces: '/traces',
      regressions: '/regressions',
      slas: '/slas',
      budgets: '/budgets',
      prompts: '/prompts',
      experiments: '/experiments',
    });

    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0]?.title).toMatch(/critical regressions/i);
    expect(items.some((item) => item.actions.some((action) => action.href === '/experiments'))).toBe(true);
  });

  it('derives executive decisions from route-level metrics', () => {
    const decisions = buildExecutiveDecisions(metrics, {
      experiments: '/experiments',
      regressions: '/regressions',
      budgets: '/budgets',
    });

    expect(decisions).toHaveLength(3);
    expect(decisions[0]?.status).toBe('watch');
    expect(decisions[1]?.status).toBe('attention');
    expect(decisions[2]?.href).toBe('/budgets');
  });

  it('derives executive talking points from reliability and risk posture', () => {
    const talkingPoints = buildExecutiveTalkingPoints(
      metrics,
      'Connected operator surfaces now cover overview, investigate, improve, and govern workflows.',
    );

    expect(talkingPoints).toHaveLength(3);
    expect(talkingPoints[0]?.text).toMatch(/moved down 5 points/i);
    expect(talkingPoints[1]?.text).toMatch(/critical regressions/i);
    expect(talkingPoints[2]?.text).toMatch(/projected overspend/i);
  });

  it('can fold in route-evidence highlights ahead of generic connected-surface summary', () => {
    const talkingPoints = buildExecutiveTalkingPoints(
      {
        healthPercent: 99,
        criticalRegressions: 0,
        slaRisks: 0,
        budgetOverspendUsd: 0,
      },
      'Connected operator surfaces now cover overview, investigate, improve, and govern workflows.',
      ['Replay-ready incidents and winning candidates are both present in the current route evidence.'],
    );

    expect(talkingPoints).toHaveLength(2);
    expect(talkingPoints[0]?.text).toMatch(/Replay-ready incidents/i);
    expect(talkingPoints[1]?.text).toMatch(/Connected operator surfaces/i);
  });
});
