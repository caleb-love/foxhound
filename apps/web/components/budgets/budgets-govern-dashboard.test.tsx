import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetsGovernDashboard } from './budgets-govern-dashboard';

const metrics = [
  {
    label: 'Tracked budgets',
    value: '6',
    supportingText: 'Active guardrails across the most important production agent workflows.',
  },
  {
    label: 'At-risk budgets',
    value: '2',
    supportingText: 'Two workflows are projected to exceed their current monthly limits.',
  },
  {
    label: 'Projected overspend',
    value: '$182',
    supportingText: 'Combined projected overrun if current trace volume continues unchanged.',
  },
  {
    label: 'Largest hotspot',
    value: 'planner-agent',
    supportingText: 'Planner spend increased after new rerank behavior and prompt changes.',
  },
];

const hotspots = [
  {
    agent: 'planner-agent',
    status: 'critical' as const,
    spend: '$418',
    budget: '$300',
    description: 'Token-heavy planning spans and new tool calls increased spend above the configured budget.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    improveHref: '/experiments',
  },
];

const nextActions = [
  {
    title: 'Inspect the most expensive traces',
    description: 'Find the runs responsible for the latest budget spike and confirm whether the spend is intentional.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Check whether regressions caused the overspend',
    description: 'Use regression analysis to confirm whether new behavior drift introduced extra cost.',
    href: '/regressions',
    cta: 'Open regressions',
  },
];

describe('BudgetsGovernDashboard', () => {
  it('renders budget summary metrics and hero copy', () => {
    render(
      <BudgetsGovernDashboard metrics={metrics} hotspots={hotspots} nextActions={nextActions} />,
    );

    expect(screen.getByText('Cost Budgets')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('$182')).toBeInTheDocument();
  });

  it('renders spend hotspots and investigation links', () => {
    render(
      <BudgetsGovernDashboard metrics={metrics} hotspots={hotspots} nextActions={nextActions} />,
    );

    expect(screen.getAllByText('planner-agent').length).toBeGreaterThan(0);
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Check regressions/i })).toHaveAttribute('href', '/regressions');
    expect(screen.getByRole('link', { name: /Open improvement flow/i })).toHaveAttribute('href', '/experiments');
  });

  it('renders governance next actions', () => {
    render(
      <BudgetsGovernDashboard metrics={metrics} hotspots={hotspots} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Inspect the most expensive traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Check whether regressions caused the overspend/i })).toHaveAttribute('href', '/regressions');
  });
});
