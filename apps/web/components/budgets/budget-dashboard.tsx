'use client';

import { useState, useMemo } from 'react';
import type { Trace } from '@foxhound/types';
import { useBudgetStore } from '@/lib/stores/budget-store';
import {
  getAllBudgetStatuses,
  getTotalMonthlySpending,
  getUniqueAgents,
} from '@/lib/budget-utils';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { BudgetOverview } from './budget-overview';
import { BudgetTable } from './budget-table';
import { BudgetFormModal } from './budget-form-modal';
import { BudgetAlerts } from './budget-alerts';

interface BudgetDashboardProps {
  traces: Trace[];
}

export function BudgetDashboard({ traces }: BudgetDashboardProps) {
  const { budgets } = useBudgetStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | undefined>();
  
  // Calculate budget statuses
  const budgetStatuses = useMemo(() => {
    return getAllBudgetStatuses(budgets, traces);
  }, [budgets, traces]);
  
  // Get unique agents for "Add Budget" dropdown
  const availableAgents = useMemo(() => {
    return getUniqueAgents(traces);
  }, [traces]);
  
  // Calculate totals
  const totalBudget = budgets
    .filter((b) => b.enabled)
    .reduce((sum, b) => sum + b.monthlyLimit, 0);
  
  const totalSpent = getTotalMonthlySpending(traces);
  
  // Count alerts
  const alertCount = budgetStatuses.filter(
    (s) => s.status === 'warning' || s.status === 'critical' || s.status === 'exceeded'
  ).length;
  
  const handleAddBudget = () => {
    setEditingAgentId(undefined);
    setIsFormOpen(true);
  };
  
  const handleEditBudget = (agentId: string) => {
    setEditingAgentId(agentId);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--tenant-text-primary)', fontFamily: 'var(--font-heading)' }}>Cost Budgets</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
            Monitor and control agent spending
          </p>
        </div>
        <Button onClick={handleAddBudget} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Budget
        </Button>
      </div>
      
      {/* Alerts */}
      {alertCount > 0 && (
        <BudgetAlerts budgetStatuses={budgetStatuses} />
      )}
      
      {/* Overview Cards */}
      <BudgetOverview
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        budgetCount={budgets.filter((b) => b.enabled).length}
        alertCount={alertCount}
      />
      
      {/* Budget Table */}
      <BudgetTable
        budgetStatuses={budgetStatuses}
        onEdit={handleEditBudget}
      />
      
      {/* Budget Form Modal */}
      <BudgetFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        agentId={editingAgentId}
        availableAgents={availableAgents}
      />
    </div>
  );
}
