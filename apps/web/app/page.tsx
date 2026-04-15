import { redirect } from 'next/navigation';
import { isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

export default function HomePage() {
  if (isDashboardSandboxModeEnabled()) {
    redirect('/sandbox');
  }

  redirect('/login');
}
