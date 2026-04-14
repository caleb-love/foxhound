import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationsGovernDashboard } from './notifications-govern-dashboard';

const metrics = [
  {
    label: 'Active channels',
    value: '3',
    supportingText: 'Configured destinations currently handling operational alerts.',
  },
  {
    label: 'Healthy routes',
    value: '2',
    supportingText: 'Most alert paths are healthy and delivering successfully.',
  },
  {
    label: 'Needs attention',
    value: '1',
    supportingText: 'One channel had recent delivery failures and needs operator review.',
  },
  {
    label: 'Primary escalation path',
    value: 'ops-slack',
    supportingText: 'Most regression and SLA alerts currently route through the ops channel.',
  },
];

const channels = [
  {
    name: 'ops-slack',
    type: 'slack',
    status: 'healthy' as const,
    routingSummary: 'Routes critical regressions, SLA breaches, and budget overrun alerts to the on-call channel.',
    lastDelivery: '2 minutes ago',
    alertsHref: '/budgets',
    regressionsHref: '/regressions',
    slasHref: '/slas',
  },
];

const nextActions = [
  {
    title: 'Review the highest-signal alert sources',
    description: 'Make sure the alerts being routed are still the most useful ones for operators.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Check SLA-driven routing before the next breach',
    description: 'Verify that reliability issues will notify the correct owners before user impact increases.',
    href: '/slas',
    cta: 'Open SLAs',
  },
];

describe('NotificationsGovernDashboard', () => {
  it('renders notification summary metrics and hero copy', () => {
    render(
      <NotificationsGovernDashboard metrics={metrics} channels={channels} nextActions={nextActions} />,
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('ops-slack').length).toBeGreaterThan(0);
  });

  it('renders channel routing status and action links', () => {
    render(
      <NotificationsGovernDashboard metrics={metrics} channels={channels} nextActions={nextActions} />,
    );

    expect(screen.getByText('slack')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review alert source/i })).toHaveAttribute('href', '/budgets');
    const regressionLinks = screen.getAllByRole('link', { name: /Open regressions/i });
    expect(regressionLinks[0]).toHaveAttribute('href', '/regressions');
    const slaLinks = screen.getAllByRole('link', { name: /Open SLAs/i });
    expect(slaLinks[0]).toHaveAttribute('href', '/slas');
  });

  it('renders governance next actions', () => {
    render(
      <NotificationsGovernDashboard metrics={metrics} channels={channels} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Review the highest-signal alert sources/i })).toHaveAttribute('href', '/regressions');
    expect(screen.getByRole('link', { name: /Check SLA-driven routing before the next breach/i })).toHaveAttribute('href', '/slas');
  });
});
