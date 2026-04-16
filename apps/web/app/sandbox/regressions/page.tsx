import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { RegressionsDashboard, type RegressionRecord } from '@/components/regressions/regressions-dashboard';

export default function SandboxRegressionsPage() {
  const demo = buildLocalReviewDemo();

  const regressions: RegressionRecord[] = demo.regressions.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    traceId: r.traceId,
    diffPairId: r.diffPairId,
    promptName: r.promptName,
    summary: r.summary,
    detectedAt: new Date().toISOString(),
  }));

  return <RegressionsDashboard regressions={regressions} baseHref="/sandbox" />;
}
