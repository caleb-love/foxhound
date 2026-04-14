import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlasGovernDashboard } from './slas-govern-dashboard';

const metrics = [
  {
    label: 'Tracked SLAs',
    value: '5',
    supportingText: 'Critical production workflows currently monitored for reliability drift.',
  },
  {
    label: 'Breaching now',
    value: '1',
    supportingText: 'One workflow is already beyond its success-rate or latency target.',
  },
  {
    label: 'At-risk agents',
    value: '2',
    supportingText: 'Two workflows are trending in the wrong direction and need investigation.',
  },
  {
    label: 'Longest drift',
    value: 'planner-agent',
    supportingText: 'Planner reliability has been unstable since the latest prompt and routing change.',
  },
];

const atRiskAgents = [
  {
    agent: 'planner-agent',
    status: 'critical' as const,
    successRate: '91.2%',
    latency: '4.8s p95',
    description: 'Latency and failure rate both regressed after the latest rerank behavior change.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    replayHref: '/replay/trace_reg_1',
  },
];

const nextActions = [
  {
    title: 'Inspect the failing trace cluster',
    description: 'Review the specific executions driving the latest SLA breach.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Check for behavior regressions first',
    description: 'Use regression analysis to confirm whether the SLA drift came from a recent behavior change.',
    href: '/regressions',
    cta: 'Open regressions',
  },
];

describe('SlasGovernDashboard', () => {
  it('renders SLA summary metrics and hero copy', () => {
    render(
      <SlasGovernDashboard metrics={metrics} atRiskAgents={atRiskAgents} nextActions={nextActions} />,
    );

    expect(screen.getByText('SLA Monitoring')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('planner-agent').length).toBeGreaterThan(0);
  });

  it('renders at-risk agents and investigation links', () => {
    render(
      <SlasGovernDashboard metrics={metrics} atRiskAgents={atRiskAgents} nextActions={nextActions} />,
    );

    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText(/Success rate: 91.2%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Check regressions/i })).toHaveAttribute('href', '/regressions');
    expect(screen.getByRole('link', { name: /Open replay/i })).toHaveAttribute('href', '/replay/trace_reg_1');
  });

  it('renders SLA next actions', () => {
    render(
      <SlasGovernDashboard metrics={metrics} atRiskAgents={atRiskAgents} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Inspect the failing trace cluster/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Check for behavior regressions first/i })).toHaveAttribute('href', '/regressions');
  });
});
