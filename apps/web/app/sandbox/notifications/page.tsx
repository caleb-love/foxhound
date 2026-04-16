import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { NotificationsGovernDashboard, type NotificationRecord } from '@/components/notifications/notifications-govern-dashboard';

export default function SandboxNotificationsPage() {
  const demo = buildLocalReviewDemo();

  const channels: NotificationRecord[] = demo.notifications.map((n) => ({
    channelId: n.channelId,
    channelName: n.channelName,
    kind: n.kind,
    status: n.status,
    summary: n.summary,
  }));

  return <NotificationsGovernDashboard channels={channels} baseHref="/sandbox" />;
}
