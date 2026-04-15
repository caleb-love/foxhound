import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { RegressionsDashboard, type RegressionMetric, type RegressionRecord } from '@/components/regressions/regressions-dashboard';
import { CompareRegressionDialog } from '@/components/regressions/regression-compare-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

function formatRelativeDayLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

async function compareRegressionAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to compare regressions.' };
  }

  const agentId = String(formData.get('agentId') ?? '').trim();
  const versionA = String(formData.get('versionA') ?? '').trim();
  const versionB = String(formData.get('versionB') ?? '').trim();

  if (!agentId || !versionA || !versionB) {
    return { ok: false, error: 'Agent and both versions are required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.compareVersions(agentId, versionA, versionB);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to compare regressions right now.' };
  }
}

export default async function RegressionsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const budgets = await client.listBudgets({ limit: 50 });
  const slas = await client.listSlas({ limit: 50 });
  const agentIds = Array.from(new Set([
    ...budgets.data.map((budget) => budget.agentId),
    ...slas.data.map((sla) => sla.agentId),
  ])).sort();

  const baselineEntries = await Promise.all(
    agentIds.map(async (agentId) => {
      const baselines = await client.listBaselines(agentId);
      return baselines.data.map((baseline) => ({ agentId, version: baseline.agentVersion, createdAt: baseline.createdAt }));
    }),
  );
  const flatBaselines = baselineEntries.flat();

  const comparisonReports = await Promise.all(
    agentIds.map(async (agentId) => {
      const baselines = await client.listBaselines(agentId);
      const sorted = [...baselines.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (sorted.length < 2) return null;
      const [latest, previous] = sorted;
      const report = await client.compareVersions(agentId, previous!.agentVersion, latest!.agentVersion);
      return {
        agentId,
        previousVersion: previous!.agentVersion,
        newVersion: latest!.agentVersion,
        createdAt: latest!.createdAt,
        report,
      };
    }),
  );

  const liveReports = comparisonReports.filter((report): report is NonNullable<typeof report> => Boolean(report));

  const metrics: RegressionMetric[] = [
    {
      label: 'Active regressions',
      value: String(liveReports.reduce((sum, report) => sum + report.report.regressions.length, 0)),
      supportingText: 'Structural behavior shifts detected across the currently comparable agent baseline pairs.',
    },
    {
      label: 'Agents with baselines',
      value: String(liveReports.length),
      supportingText: 'Agents with at least two baselines available for real comparison.',
    },
    {
      label: 'Baseline snapshots',
      value: String(flatBaselines.length),
      supportingText: 'Stored baseline versions currently available across the configured agent inventory.',
    },
    {
      label: 'Latest regression check',
      value: liveReports[0] ? formatRelativeDayLabel(liveReports[0].createdAt) : 'No comparable agents',
      supportingText: 'Most recent baseline pair used for the real regression comparison pass.',
    },
  ];

  const activeRegressions: RegressionRecord[] = liveReports.map((report) => ({
    title: `${report.agentId} changed between ${report.previousVersion} and ${report.newVersion}`,
    severity: report.report.regressions.length > 0 ? (report.report.regressions.length > 1 ? 'critical' : 'warning') : 'healthy',
    changedAt: formatRelativeDayLabel(report.createdAt),
    description: report.report.regressions.length > 0
      ? `${report.report.regressions.length} structural regression(s) detected. Sample sizes: ${report.report.sampleSize.before} → ${report.report.sampleSize.after}. Most recent span change: ${report.report.regressions[0]?.span ?? 'n/a'}.`
      : 'No structural regressions detected between the latest comparable baseline pair.',
    traceHref: '/traces',
    diffHref: '/diff',
    promptHref: '/prompts',
  }));

  const likelyCauses = [
    {
      title: 'Review prompt history first',
      description: 'Use the prompt surfaces to check whether the behavior shift lines up with an intentional prompt or model change.',
      href: '/prompts',
      cta: 'Inspect prompt history',
    },
    {
      title: 'Use Run Diff to inspect execution-shape drift',
      description: 'Compare a healthy and changed execution path to validate whether the structural regression also appears in real traces.',
      href: '/diff',
      cta: 'Open run diff',
    },
    {
      title: 'Replay the changed workflow',
      description: 'Use Session Replay to inspect the transition points around the affected workflow before deciding on remediation.',
      href: '/replay',
      cta: 'Open replay',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <CompareRegressionDialog baselines={flatBaselines.map(({ agentId, version }) => ({ agentId, version }))} compareRegressionAction={compareRegressionAction} />
      </div>
      <RegressionsDashboard
        metrics={metrics}
        activeRegressions={activeRegressions}
        likelyCauses={likelyCauses}
      />
    </>
  );
}
