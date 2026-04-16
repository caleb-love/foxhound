import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { RegressionsDashboard } from '@/components/regressions/regressions-dashboard';
import { authOptions } from '@/lib/auth';

export default async function RegressionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Regressions are computed by the worker from trace baselines.
  // The dashboard shows an empty state until real regression data is available.
  return <RegressionsDashboard regressions={[]} />;
}
