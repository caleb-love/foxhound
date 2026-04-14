import { redirect } from 'next/navigation';
import { isDashboardDemoModeEnabled } from '@/lib/demo-auth';

export default function HomePage() {
  if (isDashboardDemoModeEnabled()) {
    return null;
  }

  redirect('/login');
}
