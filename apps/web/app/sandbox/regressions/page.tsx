import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { RegressionsDashboard } from '@/components/regressions/regressions-dashboard';

export default function SandboxRegressionsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <RegressionsDashboard
      metrics={[
        {
          label: 'Open regressions',
          value: String(demo.regressions.filter((item: (typeof demo.regressions)[number]) => item.severity !== 'healthy').length),
          supportingText: 'The hero demo centers on refund behavior quality drift after a mid-week prompt rollout.',
        },
        {
          label: 'Replay targets',
          value: String(demo.replayTargetTraceIds.length),
          supportingText: 'Use replay and run diff together to isolate behavior changes quickly.',
        },
        {
          label: 'Affected prompt families',
          value: '2',
          supportingText: 'support-reply and refund-policy-check are both implicated as the week-long incident unfolds.',
        },
        {
          label: 'Validated recoveries',
          value: String(demo.regressions.filter((item: (typeof demo.regressions)[number]) => item.severity === 'healthy').length),
          supportingText: 'One recovery is already validated and another is supported by the broader weekly evidence.',
        },
      ]}
      activeRegressions={demo.regressions.map((regression: (typeof demo.regressions)[number]) => ({
        title: regression.title,
        severity: regression.severity,
        changedAt: regression.severity === 'healthy' ? 'late week after v19 validation' : 'mid-week after support-reply v18 rollout',
        description: regression.summary,
        traceHref: `/sandbox/traces/${regression.traceId}`,
        diffHref: (() => {
          const pair = demo.diffPairs.find((item: (typeof demo.diffPairs)[number]) => item.id === regression.diffPairId);
          return pair
            ? `/sandbox/diff?a=${pair.baselineTraceId}&b=${pair.comparisonTraceId}`
            : '/sandbox/traces';
        })(),
        promptHref: (() => {
          const promptIdByName: Record<string, string> = {
            'support-reply': 'prompt_support_reply',
            'refund-policy-check': 'prompt_refund_policy_check',
            'escalation-triage': 'prompt_escalation_triage',
          };
          const promptId = regression.promptName ? promptIdByName[regression.promptName] : undefined;
          return promptId ? `/sandbox/prompts/${promptId}` : undefined;
        })(),
      }))}
      likelyCauses={[
        {
          title: 'Prompt compression reduced refund nuance',
          description: 'Version 18 made the response path cheaper and faster, but removed enough policy nuance to trigger incorrect refund handling.',
          href: '/sandbox/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression',
          cta: 'Compare baseline vs regression',
        },
        {
          title: 'Recovery candidate is ready for promotion review',
          description: 'Version 19 restores correctness with a modest cost increase according to the hero experiment.',
          href: '/sandbox/experiments',
          cta: 'Open experiments',
        },
      ]}
    />
  );
}
