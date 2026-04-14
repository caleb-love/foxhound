import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { RegressionsDashboard } from '@/components/regressions/regressions-dashboard';

export default function DemoRegressionsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <RegressionsDashboard
      metrics={[
        {
          label: 'Open regressions',
          value: String(demo.regressions.filter((item: (typeof demo.regressions)[number]) => item.severity !== 'healthy').length),
          supportingText: 'The hero demo centers on refund behavior quality drift after a prompt rollout.',
        },
        {
          label: 'Replay targets',
          value: String(demo.replayTargetTraceIds.length),
          supportingText: 'Use replay and run diff together to isolate behavior changes quickly.',
        },
        {
          label: 'Affected prompt families',
          value: '1',
          supportingText: 'support-reply is the primary prompt family implicated in the hero story.',
        },
        {
          label: 'Validated recoveries',
          value: String(demo.regressions.filter((item: (typeof demo.regressions)[number]) => item.severity === 'healthy').length),
          supportingText: 'One recovery path is already validated for promotion review.',
        },
      ]}
      activeRegressions={demo.regressions.map((regression: (typeof demo.regressions)[number]) => ({
        title: regression.title,
        severity: regression.severity,
        changedAt: regression.severity === 'healthy' ? 'after v19 validation' : 'after support-reply v18 rollout',
        description: regression.summary,
        traceHref: `/demo/traces/${regression.traceId}`,
        diffHref: (() => {
          const pair = demo.diffPairs.find((item: (typeof demo.diffPairs)[number]) => item.id === regression.diffPairId);
          return pair
            ? `/demo/diff?a=${pair.baselineTraceId}&b=${pair.comparisonTraceId}`
            : '/demo/traces';
        })(),
        promptHref: (() => {
          const promptIdByName: Record<string, string> = {
            'support-reply': 'prompt_support_reply',
            'refund-policy-check': 'prompt_refund_policy_check',
            'escalation-triage': 'prompt_escalation_triage',
          };
          const promptId = regression.promptName ? promptIdByName[regression.promptName] : undefined;
          return promptId ? `/demo/prompts/${promptId}` : undefined;
        })(),
      }))}
      likelyCauses={[
        {
          title: 'Prompt compression reduced refund nuance',
          description: 'Version 18 made the response path cheaper and faster, but removed enough policy nuance to trigger incorrect refund handling.',
          href: '/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression',
          cta: 'Compare baseline vs regression',
        },
        {
          title: 'Recovery candidate is ready for promotion review',
          description: 'Version 19 restores correctness with a modest cost increase according to the hero experiment.',
          href: '/demo/experiments',
          cta: 'Open experiments',
        },
      ]}
    />
  );
}
