import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FleetOverview } from './fleet-overview';

const metrics = [
  {
    label: 'Fleet health',
    value: '92%',
    supportingText: '3 agents need attention after recent prompt changes.',
  },
  {
    label: 'Critical regressions',
    value: '2',
    supportingText: 'Both are linked to agents updated in the last 24 hours.',
  },
  {
    label: 'SLA risk',
    value: '4',
    supportingText: 'Agents with latency or success-rate drift.',
  },
  {
    label: 'Budget risk',
    value: '$182',
    supportingText: 'Projected overspend this billing period.',
  },
];

const changeFeed = [
  {
    title: 'Prompt label moved to v12',
    description: 'Support agent production prompt was promoted 45 minutes ago.',
    status: 'warning' as const,
  },
];

const actionQueue = [
  {
    title: 'Regression spike in onboarding agent',
    description: 'Trace failures and latency drift increased after the latest release.',
    status: 'critical' as const,
  },
];

const nextActions = [
  {
    title: 'Investigate failing traces',
    description: 'Review recent failures and compare them with healthy baselines.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Review prompt changes',
    description: 'Inspect the latest prompt promotions and compare versions.',
    href: '/prompts',
    cta: 'Open prompts',
  },
];

describe('FleetOverview', () => {
  it('renders the overview hero and metric cards', () => {
    render(
      <FleetOverview
        metrics={metrics}
        changeFeed={changeFeed}
        actionQueue={actionQueue}
        nextActions={nextActions}
      />,
    );

    expect(screen.getByText('Fleet Overview')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('$182')).toBeInTheDocument();
  });

  it('renders change and action sections', () => {
    render(
      <FleetOverview
        metrics={metrics}
        changeFeed={changeFeed}
        actionQueue={actionQueue}
        nextActions={nextActions}
      />,
    );

    expect(screen.getByText('What changed')).toBeInTheDocument();
    expect(screen.getByText('What needs action')).toBeInTheDocument();
    expect(screen.getByText('Prompt label moved to v12')).toBeInTheDocument();
    expect(screen.getByText('Regression spike in onboarding agent')).toBeInTheDocument();
  });

  it('renders demo quick links when demo mode is enabled', () => {
    render(
      <FleetOverview
        metrics={metrics}
        changeFeed={changeFeed}
        actionQueue={actionQueue}
        nextActions={nextActions}
        demoMode
      />,
    );

    expect(screen.getByText('Demo quick links')).toBeInTheDocument();
    const openRouteLinks = screen.getAllByRole('link', { name: /open route/i });
    expect(openRouteLinks.length).toBeGreaterThan(0);
    expect(openRouteLinks[0]).toHaveAttribute('href', '/demo/traces/trace_support_refund_v18_regression');
  });

  it('renders recommended next action links', () => {
    render(
      <FleetOverview
        metrics={metrics}
        changeFeed={changeFeed}
        actionQueue={actionQueue}
        nextActions={nextActions}
      />,
    );

    const actionLinks = screen.getAllByRole('link', { name: /Open/i });
    expect(actionLinks.some((link) => link.getAttribute('href') === '/traces')).toBe(true);
    expect(actionLinks.some((link) => link.getAttribute('href') === '/prompts')).toBe(true);
  });
});
