import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { BudgetsGovernDashboard, type BudgetRecord } from '@/components/budgets/budgets-govern-dashboard';

export default function SandboxBudgetsPage() {
  const demo = buildLocalReviewDemo();

  const budgets: BudgetRecord[] = demo.budgets.map((b) => ({
    agentId: b.agentId,
    budgetUsd: b.budgetUsd,
    currentSpendUsd: b.currentSpendUsd,
    status: b.status,
    summary: b.summary,
  }));

  return <BudgetsGovernDashboard budgets={budgets} baseHref="/sandbox" />;
}
