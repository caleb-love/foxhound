import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluatorsDashboard } from './evaluators-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const evaluators = [
  { id: 'ev_1', name: 'refund-quality', scoringType: 'numeric', model: 'gpt-4o', health: 'healthy', summary: 'Scores refund response quality', updatedAt: new Date(now - 30 * 60 * 1000).toISOString() },
  { id: 'ev_2', name: 'tone-check', scoringType: 'categorical', model: 'gpt-4o-mini', health: 'warning', summary: 'Checks response tone', updatedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString() },
];

const olderEvaluator = { id: 'ev_3', name: 'legacy-check', scoringType: 'numeric', model: 'claude-3-5-sonnet', health: 'healthy', summary: 'Old evaluator activity', updatedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() };

describe('EvaluatorsDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders evaluator table with names and models', () => {
    render(<EvaluatorsDashboard evaluators={evaluators} />);

    expect(screen.getByText('refund-quality')).toBeInTheDocument();
    expect(screen.getByText('tone-check')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('shows verdict with health status', () => {
    render(<EvaluatorsDashboard evaluators={evaluators} />);

    expect(screen.getByText(/2 evaluators active, 1 healthy/)).toBeInTheDocument();
  });

  it('shows empty state when no evaluators exist', () => {
    render(<EvaluatorsDashboard evaluators={[]} />);

    expect(screen.getByText(/No evaluators configured/)).toBeInTheDocument();
  });

  it('keeps older evaluators visible under the default date window', () => {
    render(<EvaluatorsDashboard evaluators={[...evaluators, olderEvaluator]} />);

    expect(screen.getByText('refund-quality')).toBeInTheDocument();
    expect(screen.getByText('tone-check')).toBeInTheDocument();
    expect(screen.getByText('legacy-check')).toBeInTheDocument();
  });

  it('filters evaluators by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<EvaluatorsDashboard evaluators={[...evaluators, olderEvaluator]} />);

    expect(screen.getByText('refund-quality')).toBeInTheDocument();
    expect(screen.queryByText('tone-check')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy-check')).not.toBeInTheDocument();
  });
});
