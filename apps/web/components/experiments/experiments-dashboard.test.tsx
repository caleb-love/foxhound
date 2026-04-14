import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentsDashboard } from './experiments-dashboard';

const metrics = [
  {
    label: 'Active experiments',
    value: '3',
    supportingText: 'Candidate prompt and routing tests currently in flight or recently completed.',
  },
  {
    label: 'Ready to promote',
    value: '1',
    supportingText: 'One candidate has enough evaluator evidence to move forward.',
  },
  {
    label: 'Blocked by coverage',
    value: '1',
    supportingText: 'One experiment still needs stronger evaluator coverage before a decision.',
  },
  {
    label: 'Latest comparison',
    value: '12m ago',
    supportingText: 'Recent experiment results are fresh enough to support shipping decisions.',
  },
];

const experiments = [
  {
    name: 'support-routing-v12-vs-v11',
    status: 'completed' as const,
    dataset: 'support-latency-outliers',
    comparisonSummary: 'Version 12 reduced latency but slightly increased cost on long-context traces.',
    lastUpdated: '12 minutes ago',
    winningSignal: 'latency improved without quality regression',
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: '/traces',
    promoteHref: '/prompts?focus=support-routing&baseline=11&comparison=12',
  },
];

const nextActions = [
  {
    title: 'Review experiment winners against evaluator evidence',
    description: 'Confirm the candidate with the best scores is also safe on real production traces.',
    href: '/evaluators',
    cta: 'Open evaluators',
  },
  {
    title: 'Re-check source traces before promotion',
    description: 'Validate that the experiment outcome matches the real production failures that inspired it.',
    href: '/traces',
    cta: 'Open traces',
  },
];

describe('ExperimentsDashboard', () => {
  it('renders experiment metrics and hero copy', () => {
    render(
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />,
    );

    expect(screen.getByText('Experiments')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12m ago')).toBeInTheDocument();
  });

  it('renders comparison framing and experiment action links', () => {
    render(
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />,
    );

    expect(screen.getByText('support-routing-v12-vs-v11')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText(/Version 12 reduced latency/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review dataset/i })).toHaveAttribute('href', '/datasets');
    expect(screen.getByRole('link', { name: /Check evaluators/i })).toHaveAttribute('href', '/evaluators');
    expect(screen.getByRole('link', { name: /Inspect traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Promote candidate/i })).toHaveAttribute(
      'href',
      '/prompts?focus=support-routing&baseline=11&comparison=12',
    );
  });

  it('renders improve-loop next actions', () => {
    render(
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Review experiment winners against evaluator evidence/i })).toHaveAttribute(
      'href',
      '/evaluators',
    );
    expect(screen.getByRole('link', { name: /Re-check source traces before promotion/i })).toHaveAttribute(
      'href',
      '/traces',
    );
  });
});
