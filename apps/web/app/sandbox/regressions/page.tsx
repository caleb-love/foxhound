import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { RegressionsDashboard, type RegressionRecord } from '@/components/regressions/regressions-dashboard';

export default function SandboxRegressionsPage() {
  const demo = buildLocalReviewDemo();
  const traceStartById = new Map(demo.allTraces.map((trace) => [trace.id, trace.startTimeMs]));

  const regressions: RegressionRecord[] = demo.regressions.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    traceId: r.traceId,
    diffPairId: r.diffPairId,
    promptName: r.promptName,
    summary: r.summary,
    detectedAt: traceStartById.get(r.traceId)
      ? new Date(Number(traceStartById.get(r.traceId))).toISOString()
      : undefined,
  }));

  return <RegressionsDashboard regressions={regressions} baseHref="/sandbox" />;
}
