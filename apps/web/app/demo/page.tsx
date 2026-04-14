import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import {
  FleetOverview,
  type OverviewActionItem,
  type OverviewFeedItem,
  type OverviewMetric,
} from '@/components/overview/fleet-overview';

export default function DemoOverviewPage() {
  const demo = buildLocalReviewDemo();

  const metrics: OverviewMetric[] = demo.overviewMetrics;

  const changeFeed: OverviewFeedItem[] = [
    {
      title: 'support-reply v18 rollout introduced mid-week refund regressions',
      description: 'The shared demo story now follows a full week of operations: stable baseline, rollout drift, incident fallout, and recovery across diff, replay, datasets, and experiments.',
      status: 'critical',
    },
    {
      title: 'v19 recovery candidate validated on refund edge cases',
      description: 'The leading recovery path now looks promotion-ready after trace-derived evaluation across the week’s refund edge cases.',
      status: 'healthy',
    },
    {
      title: 'Knowledge-base timeout cluster increased latency',
      description: 'Support-rag-agent remains near SLA and budget limits after a late-week timeout cluster and fallback stabilization.',
      status: 'warning',
    },
  ];

  const actionQueue: OverviewFeedItem[] = [
    {
      title: 'Investigate refund-policy-agent regression',
      description: 'Start with the hero regression trace and compare it with the baseline and recovery runs.',
      status: 'critical',
    },
    {
      title: 'Review support-rag-agent cost and latency drift',
      description: 'Timeout recovery improved quality, but the main support path still needs governance review.',
      status: 'warning',
    },
    {
      title: 'Validate alert routing for platform ops',
      description: 'One recent warning-route delivery failure is included in the notifications story.',
      status: 'warning',
    },
  ];

  const nextActions: OverviewActionItem[] = [
    {
      title: 'Open traces',
      description: `Review the seeded trace corpus with ${demo.allTraces.length} shared demo traces spanning a realistic seven-day operating window.`,
      href: '/demo/traces',
      cta: 'Open traces',
    },
    {
      title: 'Compare hero regression',
      description: 'Use run diff to see why v18 got cheaper and faster but worse on refund quality.',
      href: '/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression',
      cta: 'Open run diff',
    },
    {
      title: 'Review experiments',
      description: 'Validate the v19 recovery and other shared improvement stories.',
      href: '/demo/experiments',
      cta: 'Open experiments',
    },
    {
      title: 'Check governance surfaces',
      description: 'Review budgets, SLAs, regressions, and notifications tied to the same shared narrative.',
      href: '/demo/regressions',
      cta: 'Open governance',
    },
  ];

  return (
    <FleetOverview
      metrics={metrics}
      changeFeed={changeFeed}
      actionQueue={actionQueue}
      nextActions={nextActions}
      demoMode
    />
  );
}
