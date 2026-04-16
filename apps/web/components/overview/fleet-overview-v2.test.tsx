import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FleetOverviewV2 } from './fleet-overview-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';

const fleetMetrics: FleetMetrics = {
  healthPercent: 92,
  previousHealthPercent: 97,
  criticalRegressions: 2,
  slaRisks: 4,
  budgetOverspendUsd: 182,
};

const metricCards = [
  {
    label: 'Fleet health',
    value: '92%',
    numericValue: 92,
    previousValue: 97,
    higherIsBetter: true,
    tone: 'healthy' as const,
    href: '/traces',
    sparklineData: [{ value: 97 }, { value: 92 }],
  },
  {
    label: 'Critical regressions',
    value: '2',
    numericValue: 2,
    previousValue: 0,
    higherIsBetter: false,
    tone: 'critical' as const,
    href: '/regressions',
  },
  {
    label: 'SLA risk',
    value: '4',
    numericValue: 4,
    previousValue: 3,
    higherIsBetter: false,
    tone: 'warning' as const,
    href: '/slas',
  },
  {
    label: 'Overspend',
    value: '$182',
    numericValue: 182,
    previousValue: 90,
    higherIsBetter: false,
    tone: 'warning' as const,
    href: '/budgets',
  },
];

const actionItems = [
  {
    title: 'Investigate regression',
    context: 'Returns copilot broke damaged-shipment refunds.',
    severity: 'critical' as const,
    agentIds: ['support-agent'],
    actions: [
      { label: 'Trace', href: '/traces/abc' },
      { label: 'Run Diff', href: '/diff?a=1&b=2' },
    ],
  },
  {
    title: 'Review SLA drift',
    context: 'Planner-agent latency trending up.',
    severity: 'warning' as const,
    agentIds: ['planner-agent'],
    actions: [
      { label: 'SLAs', href: '/slas' },
    ],
  },
  {
    title: 'Recovery candidate ready',
    context: 'v19 experiment complete.',
    severity: 'healthy' as const,
    agentIds: ['support-agent'],
    actions: [
      { label: 'Experiments', href: '/experiments' },
    ],
  },
];

describe('FleetOverviewV2', () => {
  it('renders the verdict bar with auto-generated headline', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    // Verdict headline for 2 regressions + 4 SLA risks
    expect(screen.getByText(/2 critical regressions and 4 SLA risks need investigation/)).toBeInTheDocument();
  });

  it('renders the verdict narrative with health trend', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByText(/down from 97%/)).toBeInTheDocument();
  });

  it('renders verdict action buttons', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByRole('link', { name: /Investigate regressions/i })).toHaveAttribute('href', expect.stringContaining('/regressions'));
    expect(screen.getByRole('link', { name: /Review SLA risks/i })).toHaveAttribute('href', expect.stringContaining('/slas'));
  });

  it('renders all metric strip items with values', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('$182')).toBeInTheDocument();
    expect(screen.getByText('Fleet health')).toBeInTheDocument();
    expect(screen.getByText('Overspend')).toBeInTheDocument();
  });

  it('renders metric delta badges', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    // Health went from 97 to 92 = -5pp
    expect(screen.getByText('-5pp')).toBeInTheDocument();
  });

  it('renders metrics as clickable links', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.includes('/regressions'))).toBe(true);
    expect(hrefs.some((href) => href?.includes('/slas'))).toBe(true);
    expect(hrefs.some((href) => href?.includes('/budgets'))).toBe(true);
  });

  it('renders the action queue with severity-ranked items', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByText('Action queue')).toBeInTheDocument();
    expect(screen.getByText('Investigate regression')).toBeInTheDocument();
    expect(screen.getByText('Review SLA drift')).toBeInTheDocument();
    expect(screen.getByText('Recovery candidate ready')).toBeInTheDocument();
  });

  it('renders inline action buttons on action queue items', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByRole('link', { name: /^Trace$/ })).toHaveAttribute('href', expect.stringContaining('/traces/abc'));
    expect(screen.getByRole('link', { name: /^Run Diff$/ })).toHaveAttribute('href', expect.stringContaining('/diff'));
  });

  it('renders the filter toggle button', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
      />,
    );

    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('does not render sandbox toolbar when demoMode is false', () => {
    render(
      <FleetOverviewV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        actionItems={actionItems}
        demoMode={false}
      />,
    );

    expect(screen.queryByText('Sandbox')).not.toBeInTheDocument();
  });
});
