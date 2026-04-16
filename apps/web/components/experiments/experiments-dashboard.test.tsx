import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentsDashboard } from './experiments-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

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
  {
    name: 'onboarding-router-rerank-strategy',
    status: 'running' as const,
    dataset: 'onboarding-regressions',
    comparisonSummary: 'Comparing a simplified routing prompt against the current rerank-heavy execution path.',
    lastUpdated: 'now',
    winningSignal: 'awaiting evaluator completion',
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: '/regressions',
    promoteHref: '/prompts?focus=onboarding-router&baseline=11&comparison=12',
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
  beforeEach(() => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
  });

  it('renders experiments, filter bar, and comparison content', () => {
    render(
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />,
    );

    expect(screen.getByText('Experiments')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search experiments, datasets, or winning signals...')).toBeInTheDocument();
    expect(screen.getAllByText('support-routing-v12-vs-v11').length).toBeGreaterThan(0);
  });

  it('respects active segment dataset filters', () => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'Onboarding experiments',
      currentFilters: { ...defaults, datasetIds: ['onboarding-regressions'] },
      savedSegments: [],
    });

    render(
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />,
    );

    expect(screen.getByText('Segment: Onboarding experiments')).toBeInTheDocument();
    expect(screen.queryByText('support-routing-v12-vs-v11')).not.toBeInTheDocument();
  });
});
