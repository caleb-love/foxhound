import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluatorsDashboard } from './evaluators-dashboard';

const metrics = [
  {
    label: 'Active evaluators',
    value: '5',
    supportingText: 'Templates currently used to score production traces and experiment outputs.',
  },
  {
    label: 'Coverage',
    value: '72%',
    supportingText: 'Most critical traces now receive at least one evaluation signal.',
  },
  {
    label: 'Recent failures',
    value: '1',
    supportingText: 'One evaluator needs attention after a prompt/schema mismatch.',
  },
  {
    label: 'Last batch',
    value: '9m ago',
    supportingText: 'Latest evaluator runs completed recently enough to guide shipping decisions.',
  },
];

const evaluators = [
  {
    name: 'helpfulness-judge',
    scoringType: 'numeric' as const,
    model: 'gpt-4o-mini',
    lastRunStatus: 'healthy' as const,
    adoptionSummary: 'Attached to onboarding and support datasets',
    lastRunSummary: 'Scored 84 traces with median 0.78',
    tracesHref: '/traces',
    datasetsHref: '/datasets',
    experimentsHref: '/experiments',
    compareHref: '/experiments',
  },
];

const nextActions = [
  {
    title: 'Review low-confidence scores',
    description: 'Inspect traces where evaluator output disagrees with the expected user outcome.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Use datasets to expand evaluator coverage',
    description: 'Add more trace-derived cases before using a candidate prompt in production.',
    href: '/datasets',
    cta: 'Open datasets',
  },
];

describe('EvaluatorsDashboard', () => {
  it('renders evaluator metrics and hero copy', () => {
    render(
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />,
    );

    expect(screen.getByText('Evaluators')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('renders evaluator status and action links', () => {
    render(
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />,
    );

    expect(screen.getByText('helpfulness-judge')).toBeInTheDocument();
    expect(screen.getByText('numeric')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review traces/i })).toHaveAttribute('href', '/traces');
    const datasetsLinks = screen.getAllByRole('link', { name: /Open datasets/i });
    expect(datasetsLinks[0]).toHaveAttribute('href', '/datasets');
    expect(screen.getByRole('link', { name: /Run experiment/i })).toHaveAttribute('href', '/experiments');
    expect(screen.getByRole('link', { name: /Compare results/i })).toHaveAttribute('href', '/experiments');
  });

  it('renders improve-loop next actions', () => {
    render(
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />,
    );

    expect(screen.getByRole('link', { name: /Review low-confidence scores/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Use datasets to expand evaluator coverage/i })).toHaveAttribute('href', '/datasets');
  });
});
