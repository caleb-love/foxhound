import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegressionsDashboard } from './regressions-dashboard';

const metrics = [
  {
    label: 'Active regressions',
    value: '3',
    supportingText: 'High-confidence behavior shifts detected in the last 24 hours.',
  },
  {
    label: 'Critical impact',
    value: '1',
    supportingText: 'One regression is already affecting a production-facing workflow.',
  },
  {
    label: 'Prompt-linked',
    value: '2',
    supportingText: 'Most regressions correlate with prompt promotions or version changes.',
  },
  {
    label: 'Time to investigate',
    value: '<15m',
    supportingText: 'The highest-priority issues already have a trace and diff path attached.',
  },
];

const activeRegressions = [
  {
    title: 'Onboarding agent now fails after tool selection',
    severity: 'critical' as const,
    changedAt: '45 minutes ago',
    description: 'The latest runs introduced an extra rerank step and now fail on the final execution hop.',
    traceHref: '/traces/trace_reg_1',
    diffHref: '/diff?a=trace_good&b=trace_reg_1',
    promptHref: '/prompts?focus=onboarding-router',
  },
];

const likelyCauses = [
  {
    title: 'Prompt promotion may have changed tool routing',
    description: 'Review the latest prompt version and compare it with the previous stable revision.',
    href: '/prompts?focus=onboarding-router',
    cta: 'Inspect prompt history',
  },
  {
    title: 'Execution path drift detected',
    description: 'Open run diff to see which spans were added or modified in the failing run.',
    href: '/diff?a=trace_good&b=trace_reg_1',
    cta: 'Open run diff',
  },
];

describe('RegressionsDashboard', () => {
  it('renders regression summary metrics and hero copy', () => {
    render(
      <RegressionsDashboard
        metrics={metrics}
        activeRegressions={activeRegressions}
        likelyCauses={likelyCauses}
      />,
    );

    expect(screen.getByText('Behavior Regressions')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('<15m')).toBeInTheDocument();
  });

  it('renders active regression investigation links', () => {
    render(
      <RegressionsDashboard
        metrics={metrics}
        activeRegressions={activeRegressions}
        likelyCauses={likelyCauses}
      />,
    );

    expect(screen.getByText('Onboarding agent now fails after tool selection')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compare runs/i })).toHaveAttribute('href', '/diff?a=trace_good&b=trace_reg_1');
  });

  it('renders likely-cause actions', () => {
    render(
      <RegressionsDashboard
        metrics={metrics}
        activeRegressions={activeRegressions}
        likelyCauses={likelyCauses}
      />,
    );

    const actionLinks = screen.getAllByRole('link', { name: /Open/i });
    expect(actionLinks.some((link) => link.getAttribute('href') === '/prompts?focus=onboarding-router')).toBe(true);
    expect(actionLinks.some((link) => link.getAttribute('href') === '/diff?a=trace_good&b=trace_reg_1')).toBe(true);
  });
});
