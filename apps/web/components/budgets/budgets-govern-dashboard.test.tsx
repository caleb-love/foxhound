import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetsGovernDashboard } from './budgets-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const budgets = [
  { agentId: 'support-agent', budgetUsd: 500, currentSpendUsd: 480, status: 'critical', summary: 'Over budget on refund workflows', updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
  { agentId: 'codegen-agent', budgetUsd: 1000, currentSpendUsd: 300, status: 'healthy', summary: 'Within budget', updatedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString() },
];

const olderBudget = { agentId: 'legacy-budget-agent', budgetUsd: 200, currentSpendUsd: 50, status: 'healthy', summary: 'Older budget sample', updatedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() };

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

  it('keeps older budgets visible under the default date window', () => {
    render(<BudgetsGovernDashboard budgets={[...budgets, olderBudget]} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByText('codegen-agent')).toBeInTheDocument();
    expect(screen.getByText('legacy-budget-agent')).toBeInTheDocument();
  });

  it('filters budgets by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<BudgetsGovernDashboard budgets={[...budgets, olderBudget]} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.queryByText('codegen-agent')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy-budget-agent')).not.toBeInTheDocument();
  });
});
