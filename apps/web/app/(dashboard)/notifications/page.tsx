import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { NotificationsGovernDashboard, type NotificationMetric, type NotificationChannelRecord } from '@/components/notifications/notifications-govern-dashboard';
import { CreateNotificationChannelDialog, CreateNotificationRuleDialog, TestNotificationDialog } from '@/components/govern/govern-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

async function createNotificationChannelAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to create notification channels.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const webhookUrl = String(formData.get('webhookUrl') ?? '').trim();
  const channel = String(formData.get('channel') ?? '').trim();
  const dashboardBaseUrl = String(formData.get('dashboardBaseUrl') ?? '').trim();

  if (!name || !webhookUrl) {
    return { ok: false, error: 'Channel name and webhook URL are required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createChannel({
      name,
      kind: 'slack',
      config: {
        webhookUrl,
        channel: channel || undefined,
        dashboardBaseUrl: dashboardBaseUrl || undefined,
      },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create notification channel right now.' };
  }
}

async function createNotificationRuleAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to create alert rules.' };
  }

  const channelId = String(formData.get('channelId') ?? '').trim();
  const eventType = String(formData.get('eventType') ?? '').trim() as 'agent_failure' | 'anomaly_detected' | 'cost_spike' | 'compliance_violation';
  const minSeverity = String(formData.get('minSeverity') ?? 'high').trim() as 'critical' | 'high' | 'medium' | 'low';

  if (!channelId) {
    return { ok: false, error: 'A channel is required to create an alert rule.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createAlertRule({ eventType, minSeverity, channelId });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create alert rule right now.' };
  }
}

async function testNotificationAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to send test notifications.' };
  }

  const channelId = String(formData.get('channelId') ?? '').trim();
  const eventType = String(formData.get('eventType') ?? 'agent_failure').trim() as 'agent_failure' | 'anomaly_detected' | 'cost_spike' | 'compliance_violation';
  const severity = String(formData.get('severity') ?? 'high').trim() as 'critical' | 'high' | 'medium' | 'low';

  if (!channelId) {
    return { ok: false, error: 'A channel is required to send a test notification.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.testChannel(channelId, { eventType, severity });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to send test notification right now.' };
  }
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const channelsResponse = await client.listChannels();
  const channelsEntities = channelsResponse.data;
  const rulesResponse = await client.listAlertRules();
  const rulesEntities = rulesResponse.data;

  const metrics: NotificationMetric[] = [
    {
      label: 'Active channels',
      value: String(channelsEntities.length),
      supportingText: 'Configured destinations currently handling operational alerts.',
    },
    {
      label: 'Alert rules',
      value: String(rulesEntities.length),
      supportingText: 'Current event-routing rules attached to your notification channels.',
    },
    {
      label: 'Primary escalation path',
      value: channelsEntities[0]?.name ?? 'No channels',
      supportingText: 'First configured notification channel in the current workspace inventory.',
    },
    {
      label: 'Rule-heavy channels',
      value: String(new Set(rulesEntities.map((rule) => rule.channelId)).size),
      supportingText: 'Number of channels currently referenced by at least one alert rule.',
    },
  ];

  const channels: NotificationChannelRecord[] = channelsEntities.map((channel) => ({
    name: channel.name,
    type: channel.kind,
    status: rulesEntities.some((rule) => rule.channelId === channel.id) ? 'healthy' : 'warning',
    routingSummary: rulesEntities.some((rule) => rule.channelId === channel.id)
      ? `This channel is referenced by ${rulesEntities.filter((rule) => rule.channelId === channel.id).length} alert rule(s) and is ready for real incident routing.`
      : 'No alert rules point at this channel yet. Create a rule to attach real event routing.',
    lastDelivery: 'Use Send test to verify delivery',
    alertsHref: '/budgets',
    regressionsHref: '/regressions',
    slasHref: '/slas',
  }));

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

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <CreateNotificationChannelDialog createNotificationChannelAction={createNotificationChannelAction} />
        <CreateNotificationRuleDialog
          channels={channelsEntities.map((channel) => ({ id: channel.id, name: channel.name }))}
          createNotificationRuleAction={createNotificationRuleAction}
        />
        <TestNotificationDialog
          channels={channelsEntities.map((channel) => ({ id: channel.id, name: channel.name }))}
          testNotificationAction={testNotificationAction}
        />
      </div>
      <NotificationsGovernDashboard metrics={metrics} channels={channels} nextActions={nextActions} />
    </>
  );
}
