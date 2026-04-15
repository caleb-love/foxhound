'use client';

import type { ExperimentWithRuns } from '@foxhound/api-client';
import { ActionCard, DetailActionPanel, DetailHeader, EvidenceCard, SummaryStatCard, StatusBadge } from '@/components/system/detail';

interface ExperimentDetailViewProps {
  experiment: ExperimentWithRuns;
  datasetName: string;
  baseHref?: string;
}

function formatRelativeDayLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getStatusVariant(status: ExperimentWithRuns['status']): 'healthy' | 'warning' | 'critical' | 'neutral' {
  if (status === 'completed') return 'healthy';
  if (status === 'running' || status === 'pending') return 'warning';
  if (status === 'failed') return 'critical';
  return 'neutral';
}

export function ExperimentDetailView({ experiment, datasetName, baseHref = '' }: ExperimentDetailViewProps) {
  const totalRuns = experiment.runs.length;
  const candidatePromptVersion = typeof experiment.config?.candidatePromptVersion === 'number' ? experiment.config.candidatePromptVersion : null;
  const baselinePromptVersion = typeof experiment.config?.baselinePromptVersion === 'number' ? experiment.config.baselinePromptVersion : null;
  const targetPromptId = typeof experiment.config?.targetPromptId === 'string' ? experiment.config.targetPromptId : null;
  const targetPromptName = typeof experiment.config?.targetPromptName === 'string' ? experiment.config.targetPromptName : null;
  const runsWithLatency = experiment.runs.filter((run) => typeof run.latencyMs === 'number');
  const runsWithCost = experiment.runs.filter((run) => typeof run.cost === 'number');
  const totalCost = runsWithCost.reduce((sum, run) => sum + (run.cost ?? 0), 0);
  const avgLatencyMs = runsWithLatency.length > 0
    ? Math.round(runsWithLatency.reduce((sum, run) => sum + (run.latencyMs ?? 0), 0) / runsWithLatency.length)
    : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <DetailHeader
            title={experiment.name}
            subtitle="Inspect experiment status, review attached runs, and connect the experiment back to its dataset, evaluator coverage, and release decision path."
            primaryBadge={<StatusBadge status={experiment.status} variant={getStatusVariant(experiment.status)} />}
            secondaryBadge={<StatusBadge status={datasetName} variant="neutral" />}
          />
          <div
            className="rounded-[var(--tenant-radius-panel)] border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Experiment id
            </div>
            <div className="mt-2 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{experiment.id}</div>
          </div>
        </div>

        <DetailActionPanel title="Recommended experiment actions">
          <ActionCard
            href={`${baseHref}/experiments`}
            title="Return to experiments"
            description="Go back to the experiment workbench and compare this run set against other active or completed candidates."
          />
          <ActionCard
            href={`${baseHref}/datasets`}
            title="Review source dataset"
            description="Confirm the dataset feeding this experiment still represents the production failures or low-scoring cases you intend to fix."
          />
          <ActionCard
            href={`${baseHref}/evaluators`}
            title="Review evaluator coverage"
            description="Check whether the evaluator set behind this experiment is strong enough to support a promotion decision."
          />
          <ActionCard
            href={`${baseHref}/prompts`}
            title="Move toward prompt and release review"
            description="Use prompt history and release context to decide whether this experiment should influence a real production change."
          />
        </DetailActionPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard label="Status" value={experiment.status} supportingText={`Created ${formatRelativeDayLabel(experiment.createdAt)}`} />
        <SummaryStatCard label="Dataset" value={datasetName} supportingText="Dataset supplying the evaluation cases for this experiment." />
        <SummaryStatCard label="Runs" value={String(totalRuns)} supportingText="Attached experiment runs currently recorded for this experiment." />
        <SummaryStatCard
          label="Observed output"
          value={avgLatencyMs !== null ? `${avgLatencyMs}ms avg` : 'Latency unavailable'}
          supportingText={runsWithCost.length > 0 ? `$${totalCost.toFixed(4)} total cost across runs` : 'Cost metrics unavailable'}
        />
      </div>

      <EvidenceCard title="Release decision framing">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStatCard
            label="Target prompt"
            value={targetPromptName ?? targetPromptId ?? 'No prompt linked'}
            supportingText="Prompt family this experiment is most directly trying to influence."
          />
          <SummaryStatCard
            label="Baseline prompt"
            value={baselinePromptVersion !== null ? `v${baselinePromptVersion}` : 'Unavailable'}
            supportingText="Version treated as the stable baseline in this experiment config."
          />
          <SummaryStatCard
            label="Candidate prompt"
            value={candidatePromptVersion !== null ? `v${candidatePromptVersion}` : 'Unavailable'}
            supportingText="Version under evaluation for a possible release decision."
          />
          <SummaryStatCard
            label="Decision posture"
            value={experiment.status === 'completed' ? 'Review for promotion' : 'Await more evidence'}
            supportingText={experiment.status === 'completed'
              ? 'Use runs, prompt history, and regressions together before setting or changing labels.'
              : 'Keep gathering experiment output before making a release-state change.'}
          />
        </div>
      </EvidenceCard>

      <EvidenceCard title="Experiment config">
        <pre className="overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}>
          {JSON.stringify(experiment.config, null, 2)}
        </pre>
      </EvidenceCard>

      <DetailActionPanel title="Promotion review actions">
        <ActionCard
          href={targetPromptId && baselinePromptVersion !== null && candidatePromptVersion !== null
            ? `${baseHref}/prompts/${targetPromptId}/diff?versionA=${baselinePromptVersion}&versionB=${candidatePromptVersion}`
            : `${baseHref}/prompts`}
          title="Review candidate vs baseline prompt"
          description={targetPromptId && baselinePromptVersion !== null && candidatePromptVersion !== null
            ? `Open the exact prompt diff between v${baselinePromptVersion} and v${candidatePromptVersion} before deciding whether to label or promote a version.`
            : 'Prompt or version mapping is incomplete. Start from the prompt catalog and confirm the target release candidates.'}
          disabled={!targetPromptId || baselinePromptVersion === null || candidatePromptVersion === null}
        />
        <ActionCard
          href={`${baseHref}/regressions`}
          title="Re-check regression posture"
          description="Confirm the experiment outcome is consistent with the current regression picture before changing release state."
        />
        <ActionCard
          href={`${baseHref}/prompts`}
          title="Move into release controls"
          description="Use prompt labels and version history to convert experiment evidence into an explicit environment or production decision."
        />
      </DetailActionPanel>

      <EvidenceCard title="Attached experiment runs">
        {experiment.runs.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
            No runs are attached yet. This usually means the experiment is still pending or the worker has not completed its first execution wave.
          </div>
        ) : (
          <div className="space-y-3">
            {experiment.runs.map((run) => (
              <div
                key={run.id}
                className="rounded-[var(--tenant-radius-panel-tight)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{run.id}</div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                      Dataset item {run.datasetItemId} · created {formatRelativeDayLabel(run.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={run.output ? 'output captured' : 'awaiting output'} variant={run.output ? 'healthy' : 'warning'} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Latency</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-primary)' }}>
                      {typeof run.latencyMs === 'number' ? `${run.latencyMs}ms` : 'Unavailable'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Tokens</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-primary)' }}>
                      {typeof run.tokenCount === 'number' ? String(run.tokenCount) : 'Unavailable'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Cost</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-primary)' }}>
                      {typeof run.cost === 'number' ? `$${run.cost.toFixed(4)}` : 'Unavailable'}
                    </div>
                  </div>
                </div>
                {run.output ? (
                  <pre className="mt-3 overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-xs whitespace-pre-wrap" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}>
                    {JSON.stringify(run.output, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </EvidenceCard>
    </div>
  );
}
