import { FleetOverview, type OverviewActionItem, type OverviewFeedItem, type OverviewMetric } from '@/components/overview/fleet-overview';
import { isDashboardDemoModeEnabled } from '@/lib/demo-auth';

const metrics: OverviewMetric[] = [
  {
    label: 'Fleet health',
    value: '92%',
    supportingText: 'Most agent routes are healthy; two recent changes need verification.',
  },
  {
    label: 'Critical regressions',
    value: '2',
    supportingText: 'Both map to changes shipped in the last 24 hours.',
  },
  {
    label: 'SLA risk',
    value: '4',
    supportingText: 'Agents trending toward latency or success-rate breaches.',
  },
  {
    label: 'Budget risk',
    value: '$182',
    supportingText: 'Projected overspend across the highest-volume workflows this period.',
  },
];

const changeFeed: OverviewFeedItem[] = [
  {
    title: 'Support prompt promoted to production',
    description: 'Prompt label moved to version 12 for the customer-support agent 45 minutes ago.',
    status: 'warning',
  },
  {
    title: 'Experiment candidate outperformed baseline',
    description: 'New retrieval strategy increased answer quality but may have raised cost per run.',
    status: 'healthy',
  },
  {
    title: 'Replay-worthy trace cluster detected',
    description: 'Three onboarding flows now fail at the same tool-call boundary.',
    status: 'critical',
  },
];

const actionQueue: OverviewFeedItem[] = [
  {
    title: 'Investigate onboarding regression',
    description: 'Compare failing runs against the previous stable version and inspect prompt drift.',
    status: 'critical',
  },
  {
    title: 'Review latency drift on planner agent',
    description: 'Recent traces show SLA risk due to longer tool orchestration chains.',
    status: 'warning',
  },
  {
    title: 'Validate support prompt promotion',
    description: 'Check whether version 12 improved resolution quality without introducing new errors.',
    status: 'warning',
  },
];

const nextActions: OverviewActionItem[] = [
  {
    title: 'Investigate failing traces',
    description: 'Open the traces workbench and inspect the latest unhealthy runs.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Compare a recent run',
    description: 'Jump into run diff to understand what changed between a healthy and failing execution.',
    href: '/diff',
    cta: 'Open run diff',
  },
  {
    title: 'Review prompt changes',
    description: 'Inspect prompt version history and compare recent promotions.',
    href: '/prompts',
    cta: 'Open prompts',
  },
  {
    title: 'Check governance surfaces',
    description: 'Review budgets, SLAs, and regressions to confirm production is still within bounds.',
    href: '/regressions',
    cta: 'Open regressions',
  },
];

export default function DashboardPage() {
  return (
    <FleetOverview
      metrics={metrics}
      changeFeed={changeFeed}
      actionQueue={actionQueue}
      nextActions={nextActions}
      demoMode={isDashboardDemoModeEnabled()}
    />
  );
}
