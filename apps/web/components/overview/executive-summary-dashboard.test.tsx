import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveSummaryDashboard } from './executive-summary-dashboard';

const metrics = [
  {
    label: 'Platform health',
    value: '92%',
    supportingText: 'Most monitored workflows remain healthy, with a small set of targeted risks to resolve.',
  },
  {
    label: 'Critical risks',
    value: '2',
    supportingText: 'Two issues need active review before the next release decision.',
  },
  {
    label: 'Projected overspend',
    value: '$182',
    supportingText: 'Current cost drift is manageable if the top hotspot is addressed quickly.',
  },
  {
    label: 'Promotion-ready changes',
    value: '1',
    supportingText: 'One candidate looks safe to promote pending final review.',
  },
];

const decisions = [
  {
    title: 'Decide whether support-routing v12 is safe to promote',
    status: 'watch' as const,
    description: 'Latency improved, but cost rose slightly and needs a final evaluator review.',
    href: '/experiments',
    cta: 'Open experiments',
  },
  {
    title: 'Review planner-agent reliability drift',
    status: 'attention' as const,
    description: 'Regression and SLA pages both indicate the same high-priority reliability issue.',
    href: '/regressions',
    cta: 'Open regressions',
  },
];

const highlights = [
  'Support workflows improved on latency, but cost efficiency still needs validation.',
  'Planner reliability remains the main risk to customer-facing stability.',
];

describe('ExecutiveSummaryDashboard', () => {
  it('renders executive metrics and page framing', () => {
    render(
      <ExecutiveSummaryDashboard metrics={metrics} decisions={decisions} highlights={highlights} />,
    );

    expect(screen.getByText('Leadership Overview')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('$182')).toBeInTheDocument();
  });

  it('renders decision queue links and decision items', () => {
    render(
      <ExecutiveSummaryDashboard metrics={metrics} decisions={decisions} highlights={highlights} />,
    );

    expect(screen.getByText('Decision queue')).toBeInTheDocument();
    expect(screen.getByText('Decide whether support-routing v12 is safe to promote')).toBeInTheDocument();
    expect(screen.getByText('Review planner-agent reliability drift')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open experiments/i })).toHaveAttribute('href', '/experiments');
    expect(screen.getByRole('link', { name: /Open regressions/i })).toHaveAttribute('href', '/regressions');
  });

  it('renders executive highlights', () => {
    render(
      <ExecutiveSummaryDashboard metrics={metrics} decisions={decisions} highlights={highlights} />,
    );

    expect(screen.getByText('Top-line highlights')).toBeInTheDocument();
    expect(screen.getByText(/Support workflows improved on latency/)).toBeInTheDocument();
  });
});
