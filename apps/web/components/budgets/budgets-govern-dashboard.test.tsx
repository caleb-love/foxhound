import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetsGovernDashboard } from './budgets-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const budgets = [
  { agentId: 'support-agent', budgetUsd: 500, currentSpendUsd: 480, status: 'critical', summary: 'Over budget on refund workflows' },
  { agentId: 'codegen-agent', budgetUsd: 1000, currentSpendUsd: 300, status: 'healthy', summary: 'Within budget' },
];

describe('BudgetsGovernDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders budget table with agent names and spend', () => {
    render(<BudgetsGovernDashboard budgets={budgets} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByText('codegen-agent')).toBeInTheDocument();
  });

  it('shows verdict about over-budget agents', () => {
    render(<BudgetsGovernDashboard budgets={budgets} />);

    expect(screen.getByText(/1 agent over budget/)).toBeInTheDocument();
  });

  it('shows empty state when no budgets configured', () => {
    render(<BudgetsGovernDashboard budgets={[]} />);

    expect(screen.getByText(/No budgets configured/)).toBeInTheDocument();
  });
});
