import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { NotificationsGovernDashboard } from '@/components/notifications/notifications-govern-dashboard';

export default function DemoNotificationsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <NotificationsGovernDashboard
      metrics={[
        {
          label: 'Notification channels',
          value: String(demo.notifications.length),
          supportingText: 'The week-long shared demo story includes the platform-ops routing path for critical refund incidents plus premium-support monitoring.',
        },
        {
          label: 'Warning routes',
          value: String(demo.notifications.filter((item) => item.status === 'warning').length),
          supportingText: 'One route is intentionally degraded so the notifications page feels operational rather than staged.',
        },
        {
          label: 'Critical story sources',
          value: '4',
          supportingText: 'Budgets, SLAs, regressions, and premium-support escalation all point into the same incident week narrative.',
        },
        {
          label: 'Healthy channels',
          value: String(demo.notifications.filter((item) => item.status === 'healthy').length),
          supportingText: 'As the scenario catalog expands, healthy and degraded routes can coexist in the same demo tenant.',
        },
      ]}
      channels={demo.notifications.map((item) => ({
        name: item.channelName,
        type: item.kind,
        status: item.status,
        routingSummary: item.summary,
        lastDelivery: item.status === 'warning' ? '4 minutes ago (one recent failure this week)' : '2 minutes ago',
        alertsHref: '/demo/budgets',
        regressionsHref: '/demo/regressions',
        slasHref: '/demo/slas',
      }))}
      nextActions={[
        {
          title: 'Review the triggering regression',
          description: 'Start with the refund regression that caused the highest-signal alert path in the shared demo story.',
          href: '/demo/regressions',
          cta: 'Open regressions',
        },
        {
          title: 'Check the SLA breach behind the alert',
          description: 'The same narrative also includes a refund-policy-agent SLA breach for reliability context.',
          href: '/demo/slas',
          cta: 'Open SLAs',
        },
      ]}
    />
  );
}
