import type { ExperimentComparisonResponse } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExperimentComparisonView } from '@/components/experiments/experiment-comparison-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';

interface SandboxExperimentComparisonPageProps {
  searchParams: Promise<{
    experimentIds?: string;
  }>;
}

function buildSandboxExperimentConfig(experimentId: string) {
  switch (experimentId) {
    case 'exp_returns_recovery_v19':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 18,
        candidatePromptVersion: 19,
      };
    case 'exp_shipping_fallback_hardening':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 6,
        candidatePromptVersion: 7,
      };
    case 'exp_operator_summary_grounding':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 3,
        candidatePromptVersion: 4,
      };
    default:
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
      };
  }
}

export default async function SandboxExperimentComparisonPage({
  searchParams,
}: SandboxExperimentComparisonPageProps) {
  const { experimentIds } = await searchParams;
  const ids = (experimentIds ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-tenant-text-primary">Experiment Comparison</h1>
        <PageWarningState
          title="Select at least two sandbox experiments"
          message="Choose two or more seeded experiments to compare their run output, evaluator coverage, and release posture."
          detail="Example: /sandbox/experiments/compare?experimentIds=exp_returns_recovery_v19,exp_shipping_fallback_hardening"
        />
      </div>
    );
  }

  const demo = buildLocalReviewDemo();
  const experiments = ids
    .map((id) => demo.experiments.find((experiment) => experiment.id === id))
    .filter((experiment): experiment is NonNullable<typeof experiment> => Boolean(experiment));

  if (experiments.length !== ids.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-tenant-text-primary">Experiment Comparison</h1>
        <PageErrorState
          title="Sandbox experiment comparison unavailable"
          message="One or more requested sandbox experiments could not be found."
          detail="Return to sandbox experiments and choose seeded IDs from the available workbench rows."
        />
      </div>
    );
  }

  const runs: ExperimentComparisonResponse['runs'] = [];
  const items: ExperimentComparisonResponse['items'] = [];
  const scores: ExperimentComparisonResponse['scores'] = [];

  for (const experiment of experiments) {
    const dataset = demo.datasets.find((item) => item.id === experiment.datasetId);
    const linkedTraceIds = dataset?.sourceTraceIds ?? [];

    linkedTraceIds.forEach((traceId, index) => {
      const trace = demo.allTraces.find((item) => item.id === traceId);
      if (!trace) return;

      const itemId = `${experiment.datasetId}_item_${index + 1}`;
      if (!items.some((item) => item.id === itemId)) {
        items.push({
          id: itemId,
          datasetId: experiment.datasetId,
          input: {
            traceId: trace.id,
            storyLabel: typeof trace.metadata.story_label === 'string' ? trace.metadata.story_label : trace.id,
          },
          expectedOutput: {
            expectedAgentId: trace.agentId,
            expectedPromptName: typeof trace.metadata.prompt_name === 'string' ? trace.metadata.prompt_name : null,
          },
          sourceTraceId: trace.id,
          createdAt: new Date(trace.startTimeMs).toISOString(),
        });
      }

      const latencyMs = trace.endTimeMs ? trace.endTimeMs - trace.startTimeMs : undefined;
      const tokenCount = trace.spans.reduce((sum, span) => {
        const promptTokens = span.attributes.prompt_tokens;
        const completionTokens = span.attributes.completion_tokens;
        return sum
          + (typeof promptTokens === 'number' ? promptTokens : 0)
          + (typeof completionTokens === 'number' ? completionTokens : 0);
      }, 0);
      const cost = trace.spans.reduce((sum, span) => {
        const spanCost = span.attributes.cost;
        return sum + (typeof spanCost === 'number' ? spanCost : 0);
      }, 0);

      const runId = `${experiment.id}_run_${index + 1}`;
      runs.push({
        id: runId,
        experimentId: experiment.id,
        datasetItemId: itemId,
        latencyMs,
        tokenCount: tokenCount > 0 ? tokenCount : undefined,
        cost: cost > 0 ? cost : undefined,
        output: {
          traceId: trace.id,
          status: trace.spans.some((span) => span.status === 'error') ? 'degraded' : 'healthy',
        },
        createdAt: new Date(trace.startTimeMs).toISOString(),
      });

      scores.push({
        id: `${runId}_score_quality`,
        orgId: 'sandbox-org',
        traceId: trace.id,
        name: 'quality',
        value: trace.spans.some((span) => span.status === 'error') ? 0.42 : 0.91,
        source: 'llm_judge',
        comment: runId,
        createdAt: new Date(trace.startTimeMs).toISOString(),
      });
      scores.push({
        id: `${runId}_score_label`,
        orgId: 'sandbox-org',
        traceId: trace.id,
        name: 'verdict',
        label: trace.spans.some((span) => span.status === 'error') ? 'needs-review' : 'promotion-ready',
        source: 'llm_judge',
        comment: runId,
        createdAt: new Date(trace.startTimeMs).toISOString(),
      });
    });
  }

  const comparison: ExperimentComparisonResponse = {
    experiments: experiments.map((experiment) => ({
      id: experiment.id,
      orgId: 'sandbox-org',
      datasetId: experiment.datasetId,
      name: experiment.name,
      config: buildSandboxExperimentConfig(experiment.id),
      status: experiment.status,
      createdAt: new Date().toISOString(),
      completedAt: experiment.status === 'completed' ? new Date().toISOString() : undefined,
    })),
    runs,
    items,
    scores,
  };

  return <ExperimentComparisonView comparison={comparison} baseHref="/sandbox" />;
}
