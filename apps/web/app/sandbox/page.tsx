import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import {
  FleetOverview,
  type OverviewActionItem,
  type OverviewFeedItem,
  type OverviewMetric,
} from '@/components/overview/fleet-overview';

export default function SandboxOverviewPage() {
  const demo = buildLocalReviewDemo();

  const metrics: OverviewMetric[] = demo.overviewMetrics;

  const changeFeed: OverviewFeedItem[] = [
    {
      title: 'Returns Resolution Copilot regressed after the compressed support-reply v18 rollout',
      description: 'The sandbox now tells a specific weekly story: a real-looking returns agent got cheaper and faster, but started denying damaged-shipment exceptions incorrectly.',
      status: 'critical',
    },
    {
      title: 'support-reply v19 recovered the flagship refund exception workflow',
      description: 'The recovery candidate is now backed by a larger trace-derived returns dataset, clearer labels, and a promotion-ready experiment narrative.',
      status: 'healthy',
    },
    {
      title: 'Shipping Delay Resolution stayed near the edge after a logistics timeout cluster',
      description: 'The shipping story now includes fallback recovery, SLA pressure, and budget drift tied to the same week of seeded operational data.',
      status: 'warning',
    },
  ];

  const actionQueue: OverviewFeedItem[] = [
    {
      title: 'Investigate the Returns Resolution Copilot regression story',
      description: 'Start with the hero regression trace and compare it with the baseline and recovery runs for the same refund exception case.',
      status: 'critical',
    },
    {
      title: 'Review Shipping Delay Resolution cost and latency drift',
      description: 'The timeout recovery improved quality, but the logistics workflow still sits close to its SLA and budget limits.',
      status: 'warning',
    },
    {
      title: 'Validate alert routing across returns and platform operations',
      description: 'Notification routing now includes team-specific channels like #returns-watch and the shared #platform-ops feed.',
      status: 'warning',
    },
  ];

  const nextActions: OverviewActionItem[] = [
    {
      title: 'Open traces',
      description: `Review ${demo.allTraces.length} seeded traces spanning a dense seven-day operating window across returns, shipping, billing, account recovery, fraud, and operator reporting stories.`,
      href: '/sandbox/traces',
      cta: 'Open traces',
    },
    {
      title: 'Compare hero regression',
      description: 'Use run diff to see why the compressed v18 rollout got cheaper and faster but worse on the damaged-shipment refund exception.',
      href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression',
      cta: 'Open run diff',
    },
    {
      title: 'Review experiments',
      description: 'Validate the v19 recovery and other shared improvement stories.',
      href: '/sandbox/experiments',
      cta: 'Open experiments',
    },
    {
      title: 'Check governance surfaces',
      description: 'Review budgets, SLAs, regressions, and notifications tied to the same shared narrative.',
      href: '/sandbox/regressions',
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
