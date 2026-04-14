import { NotificationsGovernDashboard, type NotificationMetric, type NotificationChannelRecord } from '@/components/notifications/notifications-govern-dashboard';

const metrics: NotificationMetric[] = [
  {
    label: 'Active channels',
    value: '3',
    supportingText: 'Configured destinations currently handling operational alerts.',
  },
  {
    label: 'Healthy routes',
    value: '2',
    supportingText: 'Most alert paths are healthy and delivering successfully.',
  },
  {
    label: 'Needs attention',
    value: '1',
    supportingText: 'One channel had recent delivery failures and needs operator review.',
  },
  {
    label: 'Primary escalation path',
    value: 'ops-slack',
    supportingText: 'Most regression and SLA alerts currently route through the ops channel.',
  },
];

const channels: NotificationChannelRecord[] = [
  {
    name: 'ops-slack',
    type: 'slack',
    status: 'healthy',
    routingSummary: 'Routes critical regressions, SLA breaches, and budget overrun alerts to the on-call channel.',
    lastDelivery: '2 minutes ago',
    alertsHref: '/budgets',
    regressionsHref: '/regressions',
    slasHref: '/slas',
  },
  {
    name: 'engineering-slack',
    type: 'slack',
    status: 'warning',
    routingSummary: 'Receives lower-severity experiment and evaluator alerts, but had a recent delivery retry.',
    lastDelivery: '17 minutes ago',
    alertsHref: '/evaluators',
    regressionsHref: '/regressions',
    slasHref: '/slas',
  },
  {
    name: 'exec-summary-webhook',
    type: 'webhook',
    status: 'critical',
    routingSummary: 'Executive summary channel is missing delivery confirmation for the last daily digest.',
    lastDelivery: 'yesterday',
    alertsHref: '/',
    regressionsHref: '/regressions',
    slasHref: '/slas',
  },
];

const nextActions = [
  {
    title: 'Review the highest-signal alert sources',
    description: 'Make sure the alerts being routed are still the most useful ones for operators.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Check SLA-driven routing before the next breach',
    description: 'Verify that reliability issues will notify the correct owners before user impact increases.',
    href: '/slas',
    cta: 'Open SLAs',
  },
  {
    title: 'Inspect budget alerts that are escalating too often',
    description: 'Reduce noisy or redundant budget alerts before they desensitize operators.',
    href: '/budgets',
    cta: 'Open budgets',
  },
];

export default function NotificationsPage() {
  return <NotificationsGovernDashboard metrics={metrics} channels={channels} nextActions={nextActions} />;
}
