import type { Trace } from '@foxhound/types';
import { BudgetDashboard } from '@/components/budgets/budget-dashboard';

async function getAllTraces(): Promise<Trace[]> {
  try {
    const response = await fetch('http://localhost:3001/api/demo/traces', {
      cache: 'no-store',
    });
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function BudgetsPage() {
  const traces = await getAllTraces();
  
  return <BudgetDashboard traces={traces} />;
}
