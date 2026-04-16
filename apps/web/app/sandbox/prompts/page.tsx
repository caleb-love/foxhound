import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import type { PromptResponse } from '@foxhound/api-client';
import { PromptListView, type PromptPerformanceMetrics } from '@/components/prompts/prompt-list-view';

export default function SandboxPromptsPage() {
  const demo = buildLocalReviewDemo();
  const prompts: PromptResponse[] = [...demo.prompts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((prompt) => ({
      id: prompt.id,
      orgId: 'sandbox-org',
      name: prompt.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  // Compute performance metrics from trace data
  const performanceByPrompt: Record<string, PromptPerformanceMetrics> = {};

  for (const prompt of demo.prompts) {
    // Count traces linked to this prompt
    const linkedTraces = demo.allTraces.filter(
      (trace) => trace.promptName === prompt.name,
    );
    const traceCount = linkedTraces.length;
    const errorCount = linkedTraces.filter(
      (trace) => trace.spans.some((span) => span.status === 'error'),
    ).length;
    const errorRate = traceCount > 0 ? errorCount / traceCount : 0;

    // Compute average cost across linked traces
    const totalCost = linkedTraces.reduce((sum, trace) => {
      return sum + trace.spans.reduce((spanSum, span) => {
        const cost = span.attributes.cost;
        return spanSum + (typeof cost === 'number' ? cost : 0);
      }, 0);
    }, 0);
    const avgCostUsd = traceCount > 0 ? totalCost / traceCount : 0;

    // Latest version
    const latestVersion = prompt.versions.length > 0
      ? Math.max(...prompt.versions.map((v) => v.version))
      : undefined;

    performanceByPrompt[prompt.name] = {
      traceCount,
      errorRate,
      avgCostUsd,
      latestVersion,
    };
  }

  return (
    <PromptListView
      prompts={prompts}
      performanceByPrompt={performanceByPrompt}
      baseHref="/sandbox"
    />
  );
}
