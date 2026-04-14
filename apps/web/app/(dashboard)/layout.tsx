import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { DemoModeBanner } from '@/components/layout/demo-mode-banner';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSessionOrDemo();
  const isDemoMode = isDashboardDemoModeEnabled();

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-foreground">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.26),transparent_40%)]" />
        {isDemoMode ? <DemoModeBanner userName={session.user.name} /> : null}
        <TopBar user={session.user} />
        <main className="relative flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
