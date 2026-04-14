import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluatorsDashboard } from './evaluators-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

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
  {
    name: 'tool-routing-review',
    scoringType: 'categorical' as const,
    model: 'claude-3-5-sonnet',
    lastRunStatus: 'warning' as const,
    adoptionSummary: 'Used on routing regressions and replay-driven investigations',
    lastRunSummary: 'Flagged 6 traces for likely tool-selection drift',
    tracesHref: '/regressions',
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
  beforeEach(() => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
  });

  it('renders evaluator metrics, filter bar, and content', () => {
    render(
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />,
    );

    expect(screen.getByText('Evaluators')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search evaluators, models, or scoring coverage...')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('helpfulness-judge')).toBeInTheDocument();
  });

  it('respects active segment model filters', () => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'Claude evaluators',
      currentFilters: { ...defaults, models: ['claude-3-5-sonnet'] },
      savedSegments: [],
    });

    render(
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />,
    );

    expect(screen.getByText('tool-routing-review')).toBeInTheDocument();
    expect(screen.queryByText('helpfulness-judge')).not.toBeInTheDocument();
  });
});
