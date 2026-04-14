import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatasetsDashboard } from './datasets-dashboard';

const metrics = [
  {
    label: 'Active datasets',
    value: '4',
    supportingText: 'Collections currently used for evaluation and experiment preparation.',
  },
  {
    label: 'Trace-derived cases',
    value: '128',
    supportingText: 'Cases imported from real traces with poor scores or failures.',
  },
  {
    label: 'Experiment-ready',
    value: '3',
    supportingText: 'Datasets with enough coverage to compare prompt or routing variants.',
  },
  {
    label: 'Latest ingestion',
    value: '15m ago',
    supportingText: 'Recent failures were converted into evaluation cases automatically.',
  },
];

const datasets = [
  {
    name: 'onboarding-regressions',
    itemCount: 42,
    sourceSummary: 'Built from failing onboarding traces where success score fell below threshold.',
    lastUpdated: '15 minutes ago',
    scoreSignal: 'success_score < 0.6',
    traceHref: '/traces',
    evaluatorsHref: '/evaluators',
    experimentHref: '/experiments',
  },
];

const nextActions = [
  {
    title: 'Inspect the newest low-scoring traces',
    description: 'Confirm the latest dataset additions came from the right production failures.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Launch a prompt or routing experiment',
    description: 'Use the current dataset to evaluate whether a candidate change fixes the regression.',
    href: '/experiments',
    cta: 'Open experiments',
  },
];

describe('DatasetsDashboard', () => {
  it('renders dataset metrics and hero copy', () => {
    render(
      <DatasetsDashboard metrics={metrics} datasets={datasets} nextActions={nextActions} />,
    );

    expect(screen.getByText('Datasets')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('15m ago')).toBeInTheDocument();
  });

  it('renders dataset lineage framing and action links', () => {
    render(
      <DatasetsDashboard metrics={metrics} datasets={datasets} nextActions={nextActions} />,
    );

    expect(screen.getByText('onboarding-regressions')).toBeInTheDocument();
    expect(screen.getByText(/Built from failing onboarding traces/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review source traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Check evaluators/i })).toHaveAttribute('href', '/evaluators');
    expect(screen.getByRole('link', { name: /Run experiment/i })).toHaveAttribute('href', '/experiments');
  });

  it('renders next-action links for the improve workflow', () => {
    render(
      <DatasetsDashboard metrics={metrics} datasets={datasets} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Inspect the newest low-scoring traces/i })).toHaveAttribute(
      'href',
      '/traces',
    );
    expect(screen.getByRole('link', { name: /Launch a prompt or routing experiment/i })).toHaveAttribute(
      'href',
      '/experiments',
    );
  });
});
