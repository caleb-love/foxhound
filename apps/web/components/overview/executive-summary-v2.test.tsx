import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveSummaryV2 } from './executive-summary-v2';
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
    label: 'Reliability',
    value: '92%',
    numericValue: 92,
    previousValue: 97,
    higherIsBetter: true,
    tone: 'healthy' as const,
  },
  {
    label: 'Cost position',
    value: '$182 over',
    numericValue: 182,
    previousValue: 90,
    higherIsBetter: false,
    tone: 'warning' as const,
  },
  {
    label: 'Risk items',
    value: '2 critical',
    numericValue: 2,
    previousValue: 0,
    higherIsBetter: false,
    tone: 'critical' as const,
  },
  {
    label: 'Ready to ship',
    value: '1',
    numericValue: 1,
    higherIsBetter: true,
    tone: 'healthy' as const,
  },
];

const decisions = [
  {
    title: 'Promote support-routing v12?',
    status: 'watch' as const,
    evidence: 'Latency improved 15%, cost rose 3%.',
    recommendation: 'Promote with monitoring',
    href: '/experiments',
    cta: 'Review experiment',
  },
  {
    title: 'Planner reliability drift',
    status: 'attention' as const,
    evidence: 'SLA breach risk.',
    recommendation: 'Hold releases',
    href: '/regressions',
    cta: 'Review regressions',
  },
];

const talkingPoints = [
  { text: 'Support latency improved but cost needs validation.' },
  { text: 'Planner is the top customer risk.' },
];

describe('ExecutiveSummaryV2', () => {
  it('renders the RAG indicator with computed status', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    // With critical regressions + SLA risks = RED
    expect(screen.getByText('RED')).toBeInTheDocument();
  });

  it('renders the RAG headline', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByText(/2 regressions with active SLA risk/)).toBeInTheDocument();
  });

  it('renders period label and generation timestamp', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
        periodLabel="Week of Apr 14, 2026"
        generatedAt="Generated 8:02am PT"
      />,
    );

    expect(screen.getByText('Week of Apr 14, 2026')).toBeInTheDocument();
    expect(screen.getByText('Generated 8:02am PT')).toBeInTheDocument();
  });

  it('renders all metric strip items', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByText('Reliability')).toBeInTheDocument();
    expect(screen.getByText('Cost position')).toBeInTheDocument();
    expect(screen.getByText('Risk items')).toBeInTheDocument();
    expect(screen.getByText('Ready to ship')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders metric deltas', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    // Reliability from 97 to 92 = -5pp
    expect(screen.getByText('-5pp')).toBeInTheDocument();
  });

  it('renders decision cards with status labels', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByText('WATCH')).toBeInTheDocument();
    expect(screen.getByText('ATTENTION')).toBeInTheDocument();
    expect(screen.getByText('Promote support-routing v12?')).toBeInTheDocument();
    expect(screen.getByText('Planner reliability drift')).toBeInTheDocument();
  });

  it('renders decision recommendations', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByText(/Promote with monitoring/)).toBeInTheDocument();
    expect(screen.getByText(/Hold releases/)).toBeInTheDocument();
  });

  it('renders decision action links', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByRole('link', { name: /Review experiment/i })).toHaveAttribute('href', expect.stringContaining('/experiments'));
    expect(screen.getByRole('link', { name: /Review regressions/i })).toHaveAttribute('href', expect.stringContaining('/regressions'));
  });

  it('renders talking points as compact bullets', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    expect(screen.getByText('Talking points')).toBeInTheDocument();
    expect(screen.getByText(/Support latency improved/)).toBeInTheDocument();
    expect(screen.getByText(/Planner is the top customer risk/)).toBeInTheDocument();
  });

  it('does not duplicate decisions (no EventTimeline + PremiumPanel duplication)', () => {
    render(
      <ExecutiveSummaryV2
        fleetMetrics={fleetMetrics}
        metricCards={metricCards}
        decisions={decisions}
        talkingPoints={talkingPoints}
      />,
    );

    // Each decision title should appear exactly once
    const promoteTitles = screen.getAllByText('Promote support-routing v12?');
    expect(promoteTitles).toHaveLength(1);
    const plannerTitles = screen.getAllByText('Planner reliability drift');
    expect(plannerTitles).toHaveLength(1);
  });

  it('renders green RAG when fleet is healthy', () => {
    const healthyMetrics: FleetMetrics = {
      healthPercent: 99,
      criticalRegressions: 0,
      slaRisks: 0,
      budgetOverspendUsd: 0,
    };

    render(
      <ExecutiveSummaryV2
        fleetMetrics={healthyMetrics}
        metricCards={metricCards}
        decisions={[]}
        talkingPoints={[]}
      />,
    );

    expect(screen.getByText('GREEN')).toBeInTheDocument();
    expect(screen.getByText(/no action required/)).toBeInTheDocument();
  });
});
