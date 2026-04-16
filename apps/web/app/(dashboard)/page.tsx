import {
  FleetOverviewV2,
  type FleetMetricInput,
  type FleetActionItem,
} from '@/components/overview/fleet-overview-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';
import { isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

const fleetMetrics: FleetMetrics = {
  healthPercent: 92,
  previousHealthPercent: 97,
  criticalRegressions: 2,
  previousCriticalRegressions: 0,
  slaRisks: 4,
  previousSlaRisks: 3,
  budgetOverspendUsd: 182,
  previousBudgetOverspendUsd: 90,
};

const metricCards: FleetMetricInput[] = [
  {
    label: 'Fleet health',
    value: '92%',
    numericValue: 92,
    previousValue: 97,
    higherIsBetter: true,
    tone: 'healthy',
    href: '/traces',
    sparklineData: [
      { value: 97 }, { value: 96 }, { value: 94 }, { value: 91 },
      { value: 89 }, { value: 90 }, { value: 92 },
    ],
  },
  {
    label: 'Critical regressions',
    value: '2',
    numericValue: 2,
    previousValue: 0,
    higherIsBetter: false,
    tone: 'critical',
    href: '/regressions',
    sparklineData: [
      { value: 0 }, { value: 0 }, { value: 1 }, { value: 1 },
      { value: 2 }, { value: 2 }, { value: 2 },
    ],
  },
  {
    label: 'SLA risk',
    value: '4',
    numericValue: 4,
    previousValue: 3,
    higherIsBetter: false,
    tone: 'warning',
    href: '/slas',
    sparklineData: [
      { value: 2 }, { value: 2 }, { value: 3 }, { value: 3 },
      { value: 3 }, { value: 4 }, { value: 4 },
    ],
  },
  {
    label: 'Overspend',
    value: '$182',
    numericValue: 182,
    previousValue: 90,
    higherIsBetter: false,
    tone: 'warning',
    href: '/budgets',
    sparklineData: [
      { value: 40 }, { value: 60 }, { value: 80 }, { value: 100 },
      { value: 130 }, { value: 160 }, { value: 182 },
    ],
  },
];

const actionItems: FleetActionItem[] = [
  {
    title: 'Investigate onboarding regression',
    context: 'Failing runs at the same tool-call boundary. Compare against previous stable version and inspect prompt drift.',
    severity: 'critical',
    agentIds: ['onboarding-router'],
    actions: [
      { label: 'Traces', href: '/traces' },
      { label: 'Regressions', href: '/regressions' },
    ],
  },
  {
    title: 'Review latency drift on planner agent',
    context: 'Recent traces show SLA risk due to longer tool orchestration chains.',
    severity: 'warning',
    agentIds: ['planner-agent'],
    actions: [
      { label: 'Traces', href: '/traces' },
      { label: 'SLAs', href: '/slas' },
    ],
  },
  {
    title: 'Validate support prompt promotion',
    context: 'Version 12 was promoted to production 45 minutes ago. Check resolution quality and error rates.',
    severity: 'warning',
    agentIds: ['support-agent'],
    actions: [
      { label: 'Prompts', href: '/prompts' },
      { label: 'Traces', href: '/traces' },
    ],
  },
  {
    title: 'Experiment candidate outperformed baseline',
    context: 'New retrieval strategy increased answer quality. Cost impact needs review.',
    severity: 'healthy',
    agentIds: ['support-agent'],
    actions: [
      { label: 'Experiments', href: '/experiments' },
    ],
  },
];

export default function DashboardPage() {
  return (
    <FleetOverviewV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      actionItems={actionItems}
      demoMode={isDashboardSandboxModeEnabled()}
    />
  );
}
