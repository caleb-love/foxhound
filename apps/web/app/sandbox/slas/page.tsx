import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { SlasGovernDashboard, type SlaRecord } from '@/components/slas/slas-govern-dashboard';

export default function SandboxSlasPage() {
  const demo = buildLocalReviewDemo();

  const slas: SlaRecord[] = demo.slas.map((s) => ({
    agentId: s.agentId,
    maxDurationMs: s.maxDurationMs,
    minSuccessRate: s.minSuccessRate,
    observedDurationMs: s.observedDurationMs,
    observedSuccessRate: s.observedSuccessRate,
    status: s.status,
    summary: s.summary,
  }));

  return <SlasGovernDashboard slas={slas} baseHref="/sandbox" />;
}
