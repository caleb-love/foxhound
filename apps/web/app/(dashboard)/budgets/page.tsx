import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { BudgetsGovernDashboard, type BudgetMetric, type BudgetRiskRecord } from '@/components/budgets/budgets-govern-dashboard';
import { ConfigureBudgetDialog } from '@/components/govern/govern-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

async function configureBudgetAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to configure budgets.' };
  }

  const agentId = String(formData.get('agentId') ?? '').trim();
  const costBudgetUsd = Number(String(formData.get('costBudgetUsd') ?? '').trim());
  const costAlertThresholdPctRaw = String(formData.get('costAlertThresholdPct') ?? '').trim();
  const budgetPeriod = String(formData.get('budgetPeriod') ?? 'monthly').trim();

  if (!agentId || Number.isNaN(costBudgetUsd)) {
    return { ok: false, error: 'Agent id and a valid budget are required.' };
  }

  const costAlertThresholdPct = costAlertThresholdPctRaw ? Number(costAlertThresholdPctRaw) : undefined;

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.setBudget(agentId, {
      costBudgetUsd,
      costAlertThresholdPct,
      budgetPeriod,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to configure budget right now.' };
  }
}

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const budgetsResponse = await client.listBudgets({ limit: 50 });
  const budgetEntities = budgetsResponse.data;

  const metrics: BudgetMetric[] = [
    {
      label: 'Tracked budgets',
      value: String(budgetEntities.length),
      supportingText: 'Active guardrails across the most important production agent workflows.',
    },
    {
      label: 'Configured monthly budgets',
      value: String(budgetEntities.filter((budget) => budget.budgetPeriod === 'monthly').length),
      supportingText: 'Monthly cost controls currently present in the workspace.',
    },
    {
      label: 'Highest configured budget',
      value: budgetEntities[0]?.costBudgetUsd ? `$${budgetEntities[0].costBudgetUsd}` : 'No budgets',
      supportingText: 'Largest configured budget value among currently tracked agents.',
    },
    {
      label: 'Largest hotspot',
      value: budgetEntities[0]?.agentId ?? 'No agents',
      supportingText: 'First configured agent in the current budget inventory.',
    },
  ];

  const hotspots: BudgetRiskRecord[] = budgetEntities.map((budget) => ({
    agent: budget.agentId,
    status: budget.costAlertThresholdPct && budget.costAlertThresholdPct >= 90 ? 'critical' : 'warning',
    spend: budget.lastCostStatus && typeof budget.lastCostStatus === 'object' && 'spend' in budget.lastCostStatus ? `$${Number(budget.lastCostStatus.spend).toFixed(2)}` : '$0.00',
    budget: budget.costBudgetUsd ? `$${budget.costBudgetUsd}` : '$0.00',
    description: `Budget period ${budget.budgetPeriod ?? 'monthly'} with alert threshold ${budget.costAlertThresholdPct ?? 80}%. Review traces and improvement workflows if spend pressure rises against this guardrail.`,
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    improveHref: '/experiments',
  }));

  const nextActions = [
    {
      title: 'Inspect the most expensive traces',
      description: 'Find the runs responsible for the latest budget spike and confirm whether the spend is intentional.',
      href: '/traces',
      cta: 'Open traces',
    },
    {
      title: 'Check whether regressions caused the overspend',
      description: 'Use regression analysis to confirm whether new behavior drift introduced extra cost.',
      href: '/regressions',
      cta: 'Open regressions',
    },
    {
      title: 'Open the improvement loop for cost-heavy agents',
      description: 'Use datasets, evaluators, and experiments to reduce cost without losing quality.',
      href: '/experiments',
      cta: 'Open experiments',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <ConfigureBudgetDialog configureBudgetAction={configureBudgetAction} />
      </div>
      <BudgetsGovernDashboard metrics={metrics} hotspots={hotspots} nextActions={nextActions} />
    </>
  );
}
