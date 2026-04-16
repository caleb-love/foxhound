'use client';

import type { ExperimentComparisonResponse } from '@foxhound/api-client';
import type { Score } from '@foxhound/types';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, FlaskConical, GitCompare, GitPullRequestArrow, TestTubeDiagonal } from 'lucide-react';
import { ComparisonBar, MetricChip, MetricStrip, VerdictBar, InlineAction, InlineActionBar } from '@/components/investigation';
import { CompareContextCard, DetailActionPanel, ActionCard, EvidenceCard, SummaryStatCard, StatusBadge } from '@/components/system/detail';
import { useExperimentCompareStore } from '@/lib/stores/experiment-compare-store';

interface ExperimentComparisonViewProps {
  comparison: ExperimentComparisonResponse;
  baseHref?: string;
}

type ComparedExperiment = ExperimentComparisonResponse['experiments'][number];
type ComparedRun = ExperimentComparisonResponse['runs'][number];

type ExperimentAggregate = {
  experiment: ComparedExperiment;
  runCount: number;
  itemCoverage: number;
  avgLatencyMs: number;
  totalCost: number;
  avgCost: number;
  avgTokenCount: number;
  scoreCount: number;
  numericScoreAverage: number | null;
};

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

function formatStatusVariant(status: ComparedExperiment['status']): 'healthy' | 'warning' | 'critical' | 'neutral' {
  if (status === 'completed') return 'healthy';
  if (status === 'running' || status === 'pending') return 'warning';
  if (status === 'failed') return 'critical';
  return 'neutral';
}

function summarizeScores(scores: Score[]) {
  const numericScores = scores.filter((score) => typeof score.value === 'number');
  const labeledScores = scores.filter((score) => typeof score.label === 'string');
  const labelCounts = new Map<string, number>();

  for (const score of labeledScores) {
    const label = score.label ?? 'unlabeled';
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  const topLabels = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    numericAverage:
      numericScores.length > 0
        ? numericScores.reduce((sum, score) => sum + (score.value ?? 0), 0) / numericScores.length
        : null,
    topLabels,
    totalCount: scores.length,
  };
}

function aggregateExperiment(
  experiment: ComparedExperiment,
  runs: ComparedRun[],
  allItems: ExperimentComparisonResponse['items'],
  allScores: ExperimentComparisonResponse['scores'],
): ExperimentAggregate {
  const experimentRuns = runs.filter((run) => run.experimentId === experiment.id);
  const uniqueItemIds = [...new Set(experimentRuns.map((run) => run.datasetItemId))];
  const experimentItems = allItems.filter((item) => uniqueItemIds.includes(item.id));
  const experimentRunIds = new Set(experimentRuns.map((run) => run.id));
  const experimentScores = allScores.filter((score) => score.comment && experimentRunIds.has(score.comment));

  const avgLatencyMs = experimentRuns.length > 0
    ? experimentRuns.reduce((sum, run) => sum + (run.latencyMs ?? 0), 0) / experimentRuns.length
    : 0;
  const totalCost = experimentRuns.reduce((sum, run) => sum + (run.cost ?? 0), 0);
  const avgCost = experimentRuns.length > 0 ? totalCost / experimentRuns.length : 0;
  const avgTokenCount = experimentRuns.length > 0
    ? experimentRuns.reduce((sum, run) => sum + (run.tokenCount ?? 0), 0) / experimentRuns.length
    : 0;
  const scoreSummary = summarizeScores(experimentScores);

  return {
    experiment,
    runCount: experimentRuns.length,
    itemCoverage: experimentItems.length,
    avgLatencyMs,
    totalCost,
    avgCost,
    avgTokenCount,
    scoreCount: experimentScores.length,
    numericScoreAverage: scoreSummary.numericAverage,
  };
}

function buildVerdict(aggregates: ExperimentAggregate[]) {
  const completedCount = aggregates.filter((aggregate) => aggregate.experiment.status === 'completed').length;
  const failedCount = aggregates.filter((aggregate) => aggregate.experiment.status === 'failed').length;
  const comparedCount = aggregates.length;

  if (failedCount > 0) {
    return {
      severity: 'warning' as const,
      headline: `${failedCount} compared experiment${failedCount !== 1 ? 's' : ''} failed`,
      summary: 'Review failed runs first, then compare healthy candidates only when the evidence set is stable enough to support a release decision.',
    };
  }

  if (completedCount === comparedCount && comparedCount > 0) {
    return {
      severity: 'success' as const,
      headline: `${comparedCount} completed experiment${comparedCount !== 1 ? 's' : ''} ready for side-by-side review`,
      summary: 'Use the aggregate metrics, evaluator score coverage, and linked prompt handoffs below to decide which candidate should move toward promotion.',
    };
  }

  return {
    severity: 'info' as const,
    headline: `${comparedCount} experiment${comparedCount !== 1 ? 's' : ''} in comparison set`,
    summary: 'Some compared experiments are still pending or running, so treat the current metrics as an intermediate read rather than a final release call.',
  };
}

export function ExperimentComparisonView({
  comparison,
  baseHref = '',
}: ExperimentComparisonViewProps) {
  const swapPair = useExperimentCompareStore((state) => state.swapPair);

  const aggregates = comparison.experiments.map((experiment) =>
    aggregateExperiment(experiment, comparison.runs, comparison.items, comparison.scores),
  );

  const verdict = buildVerdict(aggregates);
  const totalRuns = comparison.runs.length;
  const totalItems = comparison.items.length;
  const totalScores = comparison.scores.length;
  const topScoreSummary = summarizeScores(comparison.scores);
  const [baseline, comparisonExperiment, ...additionalExperiments] = aggregates;

  return (
    <div className="space-y-6 lg:space-y-8">
      <Link
        href={`${baseHref}/experiments`}
        className="inline-flex items-center gap-1.5 text-sm text-tenant-text-muted transition-colors hover:text-tenant-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Experiments
      </Link>

      <VerdictBar
        severity={verdict.severity}
        headline={verdict.headline}
        summary={verdict.summary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/experiments`} variant="primary">
              <FlaskConical className="h-3.5 w-3.5" />
              Experiment workbench
            </InlineAction>
            <InlineAction href={`${baseHref}/datasets`} variant="secondary">
              <TestTubeDiagonal className="h-3.5 w-3.5" />
              Datasets
            </InlineAction>
            <InlineAction href={`${baseHref}/prompts`} variant="secondary">
              <GitPullRequestArrow className="h-3.5 w-3.5" />
              Prompt review
            </InlineAction>
            {baseline && comparisonExperiment ? (
              <InlineAction
                href={`${baseHref}/experiments/compare?experimentIds=${encodeURIComponent(`${comparisonExperiment.experiment.id},${baseline.experiment.id}`)}`}
                variant="secondary"
                onClick={() => swapPair()}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Swap pair
              </InlineAction>
            ) : null}
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Experiments" value={String(comparison.experiments.length)} />
        <MetricChip label="Runs" value={String(totalRuns)} />
        <MetricChip label="Dataset items" value={String(totalItems)} />
        <MetricChip label="Scores" value={String(totalScores)} accent={totalScores > 0 ? 'success' : 'warning'} />
      </MetricStrip>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Compared experiments"
          value={String(comparison.experiments.length)}
          supportingText="Side-by-side candidates in this comparison set."
        />
        <SummaryStatCard
          label="Observed runs"
          value={String(totalRuns)}
          supportingText="Experiment runs contributing to the aggregate metrics below."
        />
        <SummaryStatCard
          label="Evaluation cases"
          value={String(totalItems)}
          supportingText="Unique dataset items represented across the compared experiments."
        />
        <SummaryStatCard
          label="Top score signal"
          value={topScoreSummary.numericAverage !== null ? topScoreSummary.numericAverage.toFixed(2) : 'No numeric scores'}
          supportingText={topScoreSummary.topLabels.length > 0
            ? `Most common labels: ${topScoreSummary.topLabels.map(([label, count]) => `${label} (${count})`).join(', ')}`
            : 'No categorical score labels captured in the current comparison.'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {aggregates.map((aggregate, index) => (
          <CompareContextCard
            key={aggregate.experiment.id}
            label={index === 0 ? 'Baseline experiment' : index === 1 ? 'Comparison experiment' : `Additional experiment ${index + 1}`}
            id={aggregate.experiment.name}
            meta={[
              `ID: ${aggregate.experiment.id}`,
              `Dataset: ${aggregate.experiment.datasetId}`,
              `Status: ${aggregate.experiment.status}`,
              `Runs: ${aggregate.runCount}`,
            ]}
          />
        ))}
      </div>

      {baseline && comparisonExperiment ? (
        <EvidenceCard title="Head-to-head metrics">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ComparisonBar
              label="Average latency"
              valueA={baseline.avgLatencyMs}
              valueB={comparisonExperiment.avgLatencyMs}
              format="number"
              lowerIsBetter
            />
            <ComparisonBar
              label="Average cost"
              valueA={baseline.avgCost}
              valueB={comparisonExperiment.avgCost}
              format="currency"
              lowerIsBetter
            />
            <ComparisonBar
              label="Average tokens"
              valueA={baseline.avgTokenCount}
              valueB={comparisonExperiment.avgTokenCount}
              format="number"
              lowerIsBetter
            />
            <ComparisonBar
              label="Score volume"
              valueA={baseline.scoreCount}
              valueB={comparisonExperiment.scoreCount}
              format="number"
              lowerIsBetter={false}
            />
          </div>
        </EvidenceCard>
      ) : null}

      <EvidenceCard title="Comparison matrix">
        <div className="space-y-3">
          {aggregates.map((aggregate) => (
            <div
              key={aggregate.experiment.id}
              className="rounded-[var(--tenant-radius-panel-tight)] border p-4"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-tenant-text-primary">{aggregate.experiment.name}</div>
                  <div className="mt-1 text-sm text-tenant-text-muted">{aggregate.experiment.datasetId}</div>
                </div>
                <StatusBadge status={aggregate.experiment.status} variant={formatStatusVariant(aggregate.experiment.status)} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SummaryStatCard label="Runs" value={String(aggregate.runCount)} supportingText="Observed experiment runs." />
                <SummaryStatCard label="Coverage" value={String(aggregate.itemCoverage)} supportingText="Dataset items represented." />
                <SummaryStatCard label="Latency" value={`${Math.round(aggregate.avgLatencyMs)}ms`} supportingText="Average observed latency." />
                <SummaryStatCard label="Total cost" value={formatCurrency(aggregate.totalCost)} supportingText="Aggregate spend across runs." />
                <SummaryStatCard
                  label="Avg numeric score"
                  value={aggregate.numericScoreAverage !== null ? aggregate.numericScoreAverage.toFixed(2) : 'N/A'}
                  supportingText={`${aggregate.scoreCount} linked score${aggregate.scoreCount === 1 ? '' : 's'}.`}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <InlineAction href={`${baseHref}/experiments/${aggregate.experiment.id}`} variant="secondary">
                  <GitCompare className="h-3.5 w-3.5" />
                  Open experiment detail
                </InlineAction>
              </div>
            </div>
          ))}
        </div>
      </EvidenceCard>

      {additionalExperiments.length > 0 ? (
        <EvidenceCard title="Additional compared experiments">
          <div className="space-y-3 text-sm text-tenant-text-secondary">
            {additionalExperiments.map((aggregate) => (
              <div key={aggregate.experiment.id}>
                <span className="font-medium text-tenant-text-primary">{aggregate.experiment.name}</span>
                {' '}
                adds {aggregate.runCount} runs, {aggregate.itemCoverage} covered items, and {aggregate.scoreCount} linked scores to the comparison set.
              </div>
            ))}
          </div>
        </EvidenceCard>
      ) : null}

      <DetailActionPanel title="Recommended next actions">
        {aggregates.map((aggregate) => (
          <ActionCard
            key={aggregate.experiment.id}
            href={`${baseHref}/experiments/${aggregate.experiment.id}`}
            title={`Inspect ${aggregate.experiment.name}`}
            description="Open the full experiment detail view to inspect individual runs, prompt handoffs, and release-review context."
          />
        ))}
        <ActionCard
          href={`${baseHref}/prompts`}
          title="Move into prompt decision review"
          description="Use prompt history, diff, and labels to convert experiment evidence into a concrete release recommendation."
        />
      </DetailActionPanel>
    </div>
  );
}
