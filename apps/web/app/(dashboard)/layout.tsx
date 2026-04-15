import { AppShell } from '@/components/layout/app-shell';
import { SandboxBanner } from '@/components/layout/sandbox-banner';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSessionOrSandbox();
  const isSandboxMode = isDashboardSandboxModeEnabled();

  return (
    <AppShell
      user={session.user}
      showSegmentPersistence
      mode="dashboard"
      modeBanner={isSandboxMode ? <SandboxBanner userName={session.user.name} /> : null}
    >
      {children}
    </AppShell>
  );
}
