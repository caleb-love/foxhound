import { SlasGovernDashboard, type SlaMetric, type SlaRiskRecord } from '@/components/slas/slas-govern-dashboard';

const metrics: SlaMetric[] = [
  {
    label: 'Tracked SLAs',
    value: '5',
    supportingText: 'Critical production workflows currently monitored for reliability drift.',
  },
  {
    label: 'Breaching now',
    value: '1',
    supportingText: 'One workflow is already beyond its success-rate or latency target.',
  },
  {
    label: 'At-risk agents',
    value: '2',
    supportingText: 'Two workflows are trending in the wrong direction and need investigation.',
  },
  {
    label: 'Longest drift',
    value: 'planner-agent',
    supportingText: 'Planner reliability has been unstable since the latest prompt and routing change.',
  },
];

const atRiskAgents: SlaRiskRecord[] = [
  {
    agent: 'planner-agent',
    status: 'critical',
    successRate: '91.2%',
    latency: '4.8s p95',
    description: 'Latency and failure rate both regressed after the latest rerank behavior change.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    replayHref: '/replay/trace_reg_1',
  },
  {
    agent: 'support-agent',
    status: 'warning',
    successRate: '95.4%',
    latency: '3.1s p95',
    description: 'Support remains within tolerance today but is drifting after the latest prompt promotion.',
    tracesHref: '/traces',
    regressionsHref: '/prompts?focus=support-routing',
    replayHref: '/replay/trace_reg_2',
  },
  {
    agent: 'onboarding-router',
    status: 'healthy',
    successRate: '98.8%',
    latency: '1.9s p95',
    description: 'Currently within SLA, but still worth monitoring after the newest routing experiment.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    replayHref: '/replay/trace_reg_3',
  },
];

const nextActions = [
  {
    title: 'Inspect the failing trace cluster',
    description: 'Review the specific executions driving the latest SLA breach.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Check for behavior regressions first',
    description: 'Use regression analysis to confirm whether the SLA drift came from a recent behavior change.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Replay the breach path step-by-step',
    description: 'Open Session Replay to find the exact transition point before the SLA started failing.',
    href: '/replay/trace_reg_1',
    cta: 'Open replay',
  },
];

export default function SLAsPage() {
  return <SlasGovernDashboard metrics={metrics} atRiskAgents={atRiskAgents} nextActions={nextActions} />;
}
