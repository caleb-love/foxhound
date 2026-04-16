import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { SlasGovernDashboard, type SlaRecord } from '@/components/slas/slas-govern-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function SlasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let slas: SlaRecord[] = [];

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listSlas();
    slas = (response.data ?? []).map((c) => ({
      agentId: c.agentId,
      maxDurationMs: Number(c.maxDurationMs ?? 30000),
      minSuccessRate: Number(c.minSuccessRate ?? 0.95),
      observedDurationMs: 0,
      observedSuccessRate: 1,
      status: 'healthy',
      summary: `Target: ${(Number(c.maxDurationMs ?? 30000) / 1000).toFixed(0)}s max, ${((Number(c.minSuccessRate ?? 0.95)) * 100).toFixed(0)}% success`,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // Fall through with empty array
  }

  return <SlasGovernDashboard slas={slas} />;
}
