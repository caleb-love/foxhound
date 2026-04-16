import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { NotificationsGovernDashboard, type NotificationRecord } from '@/components/notifications/notifications-govern-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let channels: NotificationRecord[] = [];

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listChannels();
    channels = (response.data ?? []).map((ch) => ({
      channelId: ch.id,
      channelName: ch.name,
      kind: ch.kind,
      status: 'healthy',
      summary: `${ch.kind} channel`,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // Fall through with empty array
  }

  return <NotificationsGovernDashboard channels={channels} />;
}
