import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExecutiveSummaryDashboard } from '@/components/overview/executive-summary-dashboard';

export default function SandboxExecutivePage() {
  const demo = buildLocalReviewDemo();

  return (
    <ExecutiveSummaryDashboard
      metrics={demo.executiveMetrics}
      decisions={[
        {
          title: 'Decide whether support-reply v19 is safe to promote',
          status: 'watch',
          description: 'The refund recovery experiment is complete and now stands out as the strongest promotion candidate from the seven-day review window.',
          href: '/sandbox/experiments',
          cta: 'Open experiments',
        },
        {
          title: 'Contain refund-policy-agent overspend',
          status: 'attention',
          description: 'The refund incident now has linked budget, SLA, regression, and notification evidence across the same seven-day demo story.',
          href: '/sandbox/budgets',
          cta: 'Open budgets',
        },
        {
          title: 'Validate platform alert routing for critical incidents',
          status: 'on-track',
          description: 'Notifications are wired into the same governance narrative, with one warning route included for realism.',
          href: '/sandbox/notifications',
          cta: 'Open notifications',
        },
      ]}
      highlights={[
        'Refund regressions were detected mid-week, traced to prompt and policy changes, and validated through trace-derived experiments.',
        'The shared demo now covers investigation, improvement, and governance surfaces from one reusable scenario source.',
        `The demo trace corpus includes ${demo.allTraces.length} traces with curated anchors plus realistic healthy background activity across a full week.`,
      ]}
    />
  );
}
