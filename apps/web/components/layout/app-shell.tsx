import { Suspense, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { SegmentPersistenceBridge } from '@/components/layout/segment-persistence-bridge';
import { ThemeModeToggleButton } from '@/components/theme/theme-mode-toggle';

import { InvestigationBreadcrumb } from '@/components/investigation/breadcrumb';
import { CompactModeProvider, CompactModeToggle } from '@/components/investigation/compact-mode';

interface ShellUser {
  name: string;
  email: string;
}

interface AppShellProps {
  children: ReactNode;
  user?: ShellUser;
  showSegmentPersistence?: boolean;
  mode?: 'dashboard' | 'sandbox';
  modeBanner?: ReactNode;
}

function ShellModeHeader({ mode }: { mode: 'dashboard' | 'sandbox' }) {
  if (mode === 'sandbox') {
    return (
      <div
        className="rounded-full border px-3 py-1 text-sm font-medium shadow-sm"
        style={{
          borderColor: 'color-mix(in srgb, var(--tenant-warning) 35%, transparent)',
          background: 'color-mix(in srgb, var(--tenant-warning) 12%, transparent)',
          color: 'var(--tenant-text-primary)',
        }}
      >
        Sandbox
      </div>
    );
  }

  return null;
}

export function AppShell({
  children,
  user,
  showSegmentPersistence = false,
  mode = 'dashboard',
  modeBanner,
}: AppShellProps) {
  const bodyClassName = mode === 'sandbox'
    ? 'flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--tenant-app-bg-accent-a),transparent_26%),radial-gradient(circle_at_top_right,var(--tenant-app-bg-accent-b),transparent_20%),var(--tenant-app-bg)] text-[var(--tenant-text-primary)] transition-colors duration-300'
    : 'flex h-screen overflow-hidden bg-background text-foreground';

  const contentClassName = mode === 'dashboard'
    ? 'relative flex flex-1 flex-col overflow-hidden'
    : 'flex flex-1 flex-col overflow-hidden';

  const shell = (
    <div className={bodyClassName}>
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className={contentClassName}>
        {mode === 'dashboard' ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at top, color-mix(in oklab, var(--primary) 8%, transparent), transparent 30%)',
            }}
          />
        ) : null}
        {modeBanner}
        {showSegmentPersistence ? (
          <Suspense fallback={null}>
            <SegmentPersistenceBridge />
          </Suspense>
        ) : null}
        {user ? (
          <TopBar user={user} mode={mode} leadingContent={<ShellModeHeader mode={mode} />} />
        ) : mode === 'sandbox' ? (
          <header
            className="relative flex h-16 items-center justify-between border-b px-6 backdrop-blur-xl"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 85%, transparent)' }}
          >
            <ShellModeHeader mode={mode} />
            <div className="hidden items-center gap-3 md:flex">
              <CompactModeToggle />
              <ThemeModeToggleButton />
            </div>
          </header>
        ) : null}
        <main className="relative flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            <InvestigationBreadcrumb />
            {children}
          </div>
        </main>
      </div>
    </div>
  );

  return <CompactModeProvider>{shell}</CompactModeProvider>;
}
