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
        className="rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm"
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
  const bodyClassName =
    'relative flex h-screen overflow-hidden text-[var(--tenant-text-primary)] transition-colors duration-300';

  const contentClassName = 'relative flex flex-1 flex-col overflow-hidden';

  const shell = (
    <div className={bodyClassName} style={{ background: 'var(--tenant-app-bg)' }}>
      {/*
       * Signature backdrop — hairline blueprint grid + warm/cool wash.
       * Sits below all content, ignores pointer events, only visible on
       * quiet ground. This is what makes the app read as Foxhound at a
       * glance with all logos and copy removed.
       */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 10% 0%, var(--tenant-app-bg-accent-a), transparent 32%), radial-gradient(circle at 90% 100%, var(--tenant-app-bg-accent-b), transparent 36%), var(--tenant-app-grid)',
          backgroundAttachment: 'fixed, fixed, fixed, fixed, fixed, fixed',
        }}
      />
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className={contentClassName}>
        {mode === 'dashboard' ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at top, color-mix(in oklab, var(--tenant-brand) 6%, transparent), transparent 32%)',
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
            className="relative flex h-16 items-center justify-between gap-3 border-b pl-20 pr-4 backdrop-blur-xl md:pl-6 md:pr-6"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 85%, transparent)' }}
          >
            <ShellModeHeader mode={mode} />
            <div className="hidden items-center gap-3 md:flex">
              <CompactModeToggle />
              <ThemeModeToggleButton />
            </div>
          </header>
        ) : null}
        <main className="relative flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
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
