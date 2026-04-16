import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { BudgetsGovernDashboard, type BudgetRecord } from '@/components/budgets/budgets-govern-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let budgets: BudgetRecord[] = [];

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listBudgets();
    budgets = (response.data ?? []).map((c) => ({
      agentId: c.agentId,
      budgetUsd: Number(c.costBudgetUsd ?? 0),
      currentSpendUsd: 0,
      status: 'healthy',
      summary: `Budget: $${c.costBudgetUsd ?? 0}, alert at ${c.costAlertThresholdPct ?? 80}%`,
    }));
  } catch {
    // Fall through with empty array
  }

  return <BudgetsGovernDashboard budgets={budgets} />;
}
