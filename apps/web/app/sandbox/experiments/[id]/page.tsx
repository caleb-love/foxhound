import type { ExperimentWithRuns } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExperimentDetailView } from '@/components/experiments/experiment-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';

interface SandboxExperimentDetailPageProps {
  params: Promise<{ id: string }>;
}

function buildSandboxExperimentConfig(experimentId: string) {
  switch (experimentId) {
    case 'exp_returns_recovery_v19':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 18,
        candidatePromptVersion: 19,
        evaluationFocus: 'refund exception grounding',
      };
    case 'exp_premium_escalation_tuning':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 11,
        candidatePromptVersion: 12,
        evaluationFocus: 'premium escalation sensitivity',
      };
    case 'exp_shipping_fallback_hardening':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 6,
        candidatePromptVersion: 7,
        evaluationFocus: 'shipping fallback resilience',
      };
    case 'exp_operator_summary_grounding':
      return {
        targetPromptId: 'prompt_support_reply',
        targetPromptName: 'support-reply',
        baselinePromptVersion: 3,
        candidatePromptVersion: 4,
        evaluationFocus: 'operator summary specificity',
      };
    default:
      return {
        evaluationFocus: 'seeded experiment validation',
      };
  }
}

export default async function SandboxExperimentDetailPage({
  params,
}: SandboxExperimentDetailPageProps) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const experiment = demo.experiments.find((item) => item.id === id);

  if (!experiment) {
    return (
      <PageContainer>
        <PageErrorState
          title="Experiment not found"
          message="The requested sandbox experiment could not be found in the seeded improve workbench."
          detail="Return to sandbox experiments and choose one of the available seeded candidates."
        />
      </PageContainer>
    );
  }

  const dataset = demo.datasets.find((item) => item.id === experiment.datasetId);
  const linkedTraceIds = dataset?.sourceTraceIds ?? [];
  const linkedTraces = linkedTraceIds
    .map((traceId) => demo.allTraces.find((trace) => trace.id === traceId))
    .filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const baseConfig = buildSandboxExperimentConfig(experiment.id);

  const runs = linkedTraces.map((trace, index) => {
    const durationMs = trace.endTimeMs ? trace.endTimeMs - trace.startTimeMs : undefined;
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

    return {
      id: `${experiment.id}_run_${index + 1}`,
      experimentId: experiment.id,
      datasetItemId: `${experiment.datasetId}_item_${index + 1}`,
      latencyMs: durationMs,
      tokenCount: tokenCount > 0 ? tokenCount : undefined,
      cost: cost > 0 ? cost : undefined,
      output: {
        traceId: trace.id,
        storyLabel:
          typeof trace.metadata.story_label === 'string' ? trace.metadata.story_label : trace.id,
        status: trace.spans.some((span) => span.status === 'error') ? 'degraded' : 'healthy',
        agentId: trace.agentId,
      },
      createdAt: new Date(trace.startTimeMs).toISOString(),
    };
  });

  const experimentResponse: ExperimentWithRuns = {
    id: experiment.id,
    orgId: 'sandbox-org',
    datasetId: experiment.datasetId,
    name: experiment.name,
    config: {
      ...baseConfig,
      seededWinningCandidate: experiment.winningCandidate,
      seededSummary: experiment.summary,
    },
    status: experiment.status,
    createdAt: new Date().toISOString(),
    completedAt: experiment.status === 'completed' ? new Date().toISOString() : undefined,
    runs,
  };

  return (
    <ExperimentDetailView
      experiment={experimentResponse}
      datasetName={dataset?.name ?? experiment.datasetId}
      baseHref="/sandbox"
    />
  );
}
