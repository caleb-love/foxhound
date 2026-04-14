import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export function isDashboardDemoModeEnabled(): boolean {
  return process.env['FOXHOUND_UI_DEMO_MODE'] === 'true';
}

export interface DashboardSessionLike {
  user: {
    id: string;
    name: string;
    email: string;
    token: string;
    orgId: string;
  };
}

export async function getDashboardSessionOrDemo(): Promise<DashboardSessionLike> {
  const session = await getServerSession(authOptions);

  if (session) {
    return session as DashboardSessionLike;
  }

  if (isDashboardDemoModeEnabled()) {
    return {
      user: {
        id: 'demo-user',
        name: 'Demo Operator',
        email: 'demo@foxhound.local',
        token: 'demo-token',
        orgId: 'demo-org',
      },
    };
  }

  redirect('/login');
}
