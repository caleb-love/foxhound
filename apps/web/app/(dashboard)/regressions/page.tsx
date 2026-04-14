import { RegressionsDashboard, type RegressionMetric, type RegressionRecord } from '@/components/regressions/regressions-dashboard';

const metrics: RegressionMetric[] = [
  {
    label: 'Active regressions',
    value: '3',
    supportingText: 'High-confidence behavior shifts detected across production agent flows.',
  },
  {
    label: 'Critical impact',
    value: '1',
    supportingText: 'One regression is affecting a customer-facing onboarding workflow right now.',
  },
  {
    label: 'Prompt-linked',
    value: '2',
    supportingText: 'Most regressions correlate with prompt promotions or version changes.',
  },
  {
    label: 'Time to investigate',
    value: '<15m',
    supportingText: 'Trace, diff, and prompt routes are already attached to the highest-priority issues.',
  },
];

const activeRegressions: RegressionRecord[] = [
  {
    title: 'Onboarding agent now fails after tool selection',
    severity: 'critical',
    changedAt: '45 minutes ago',
    description: 'The latest run added a rerank step and now fails on the final execution hop after prompt version 12 was promoted.',
    traceHref: '/traces/trace_reg_1',
    diffHref: '/diff?a=trace_good&b=trace_reg_1',
    promptHref: '/prompts?focus=onboarding-router',
  },
  {
    title: 'Support workflow latency increased after prompt update',
    severity: 'warning',
    changedAt: '2 hours ago',
    description: 'Runs complete successfully, but added planning work increased latency and cost beyond the usual baseline.',
    traceHref: '/traces/trace_reg_2',
    diffHref: '/diff?a=trace_baseline&b=trace_reg_2',
    promptHref: '/prompts?focus=support-routing',
  },
  {
    title: 'Planner agent changed execution shape',
    severity: 'warning',
    changedAt: 'today',
    description: 'No customer-visible failure yet, but run diff shows new span patterns that may indicate behavior drift.',
    traceHref: '/traces/trace_reg_3',
    diffHref: '/diff?a=trace_prev&b=trace_reg_3',
  },
];

const likelyCauses = [
  {
    title: 'Prompt promotion may have changed tool routing',
    description: 'Review the latest prompt revision and compare it with the previous stable version.',
    href: '/prompts?focus=onboarding-router',
    cta: 'Inspect prompt history',
  },
  {
    title: 'Execution path drift detected',
    description: 'Open run diff to confirm which spans were added, removed, or slowed down.',
    href: '/diff?a=trace_good&b=trace_reg_1',
    cta: 'Open run diff',
  },
  {
    title: 'Replay the failure step-by-step',
    description: 'Use Session Replay to find the exact transition point before the failure appears.',
    href: '/replay/trace_reg_1',
    cta: 'Open replay',
  },
];

export default function RegressionsPage() {
  return (
    <RegressionsDashboard
      metrics={metrics}
      activeRegressions={activeRegressions}
      likelyCauses={likelyCauses}
    />
  );
}
