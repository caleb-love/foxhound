import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluatorsDashboard } from './evaluators-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const evaluators = [
  { id: 'ev_1', name: 'refund-quality', scoringType: 'numeric', model: 'gpt-4o', health: 'healthy', summary: 'Scores refund response quality' },
  { id: 'ev_2', name: 'tone-check', scoringType: 'categorical', model: 'gpt-4o-mini', health: 'warning', summary: 'Checks response tone' },
];

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
});
