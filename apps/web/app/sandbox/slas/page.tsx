import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { SlasGovernDashboard } from '@/components/slas/slas-govern-dashboard';

export default function SandboxSLAsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <SlasGovernDashboard
      metrics={[
        {
          label: 'SLA-configured agents',
          value: String(demo.slas.length),
          supportingText: 'The week-long shared demo story highlights refund-policy-agent reliability drift alongside other monitored agents.',
        },
        {
          label: 'Critical breaches',
          value: String(demo.slas.filter((item) => item.status === 'critical').length),
          supportingText: 'The hero story includes a combined latency and success-rate breach.',
        },
        {
          label: 'Observed success rate',
          value: `${(((demo.slas[0]?.observedSuccessRate ?? 0) * 100).toFixed(1))}%`,
          supportingText: 'Observed reliability is below the configured refund-policy target during the regression window.',
        },
        {
          label: 'Observed latency',
          value: `${(((demo.slas[0]?.observedDurationMs ?? 0) / 1000).toFixed(1))}s`,
          supportingText: 'Latency drift reinforces the investigation path from SLAs into replay and run diff.',
        },
      ]}
      atRiskAgents={demo.slas.map((item) => ({
        agent: item.agentId,
        status: item.status,
        successRate: `${(item.observedSuccessRate * 100).toFixed(1)}% vs ${(item.minSuccessRate * 100).toFixed(1)}% target`,
        latency: `${(item.observedDurationMs / 1000).toFixed(1)}s vs ${(item.maxDurationMs / 1000).toFixed(1)}s target`,
        description: item.summary,
        tracesHref: '/sandbox/traces/trace_returns_exception_v18_regression',
        regressionsHref: '/sandbox/regressions',
        replayHref: '/sandbox/replay/trace_returns_exception_v18_regression',
      }))}
      nextActions={[
        {
          title: 'Replay the breaching run',
          description: 'Use session replay to inspect where the refund workflow slowed down and quality degraded.',
          href: '/sandbox/replay/trace_returns_exception_v18_regression',
          cta: 'Open replay',
        },
        {
          title: 'Compare against the validated recovery',
          description: 'Use run diff to see how the late-week v19 fix reduces SLA pressure while restoring correctness.',
          href: '/sandbox/diff?a=trace_returns_exception_v18_regression&b=trace_returns_exception_v19_fix',
          cta: 'Open recovery diff',
        },
      ]}
    />
  );
}
