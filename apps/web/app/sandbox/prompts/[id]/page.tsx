import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { PromptDetailView } from '@/components/prompts/prompt-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';
import type { VersionMetrics } from '@/components/prompts/version-impact-strip';

export default async function SandboxPromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const prompt = demo.prompts.find((item) => item.id === id);

  if (!prompt) {
    return (
      <PageContainer>
        <PageErrorState
          title="Prompt not found"
          message="The requested sandbox prompt could not be found in the seeded catalog."
          detail="Return to sandbox prompts and choose one of the available prompt families."
        />
      </PageContainer>
    );
  }

  const promptResponse: PromptResponse = {
    id: prompt.id,
    orgId: 'sandbox-org',
    name: prompt.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const versions: PromptVersionResponse[] = [...prompt.versions].map((version) => ({
    id: `${prompt.id}-${version.version}`,
    promptId: prompt.id,
    version: version.version,
    content: version.summary,
    model: version.model,
    config: {},
    createdAt: new Date().toISOString(),
    createdBy: null,
    labels: [version.narrativeRole],
  }));

  // Compute per-version performance metrics from trace data
  const linkedTraces = demo.allTraces.filter(
    (trace) => trace.metadata.prompt_name === prompt.name,
  );

  const performanceByVersion: Record<number, VersionMetrics> = {};

  for (const version of prompt.versions) {
    const versionTraces = linkedTraces.filter(
      (trace) => Number(trace.metadata.prompt_version) === version.version,
    );

    const traceCount = versionTraces.length;
    const errorCount = versionTraces.filter(
      (trace) => trace.spans.some((span) => span.status === 'error'),
    ).length;
    const errorRate = traceCount > 0 ? errorCount / traceCount : 0;

    const totalCost = versionTraces.reduce((sum, trace) => {
      return sum + trace.spans.reduce((spanSum, span) => {
        const cost = span.attributes.cost;
        return spanSum + (typeof cost === 'number' ? cost : 0);
      }, 0);
    }, 0);
    const avgCostUsd = traceCount > 0 ? totalCost / traceCount : 0;

    const totalDuration = versionTraces.reduce((sum, trace) => {
      return sum + (trace.endTimeMs ? trace.endTimeMs - trace.startTimeMs : 0);
    }, 0);
    const avgDurationMs = traceCount > 0 ? totalDuration / traceCount : 0;

    performanceByVersion[version.version] = {
      traceCount,
      errorRate,
      avgCostUsd,
      avgDurationMs,
    };
  }

  // Compute aggregate prompt-level metrics
  const allTraceCount = linkedTraces.length;
  const allErrorCount = linkedTraces.filter(
    (trace) => trace.spans.some((span) => span.status === 'error'),
  ).length;
  const allTotalCost = linkedTraces.reduce((sum, trace) => {
    return sum + trace.spans.reduce((spanSum, span) => {
      const cost = span.attributes.cost;
      return spanSum + (typeof cost === 'number' ? cost : 0);
    }, 0);
  }, 0);

  const promptMetrics = {
    traceCount: allTraceCount,
    errorRate: allTraceCount > 0 ? allErrorCount / allTraceCount : 0,
    avgCostUsd: allTraceCount > 0 ? allTotalCost / allTraceCount : 0,
  };

  return (
    <PromptDetailView
      prompt={promptResponse}
      versions={versions}
      performanceByVersion={performanceByVersion}
      promptMetrics={promptMetrics}
      baseHref="/sandbox"
    />
  );
}
