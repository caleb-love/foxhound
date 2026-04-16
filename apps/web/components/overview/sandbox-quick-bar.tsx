'use client';

import { Activity, GitBranch, PlaySquare, BarChart3, X } from 'lucide-react';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';

const DISMISSED_KEY = 'foxhound.sandbox-quick-bar.dismissed';

interface QuickLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const defaultLinks: QuickLink[] = [
  { label: 'Hero trace', href: '/sandbox/traces/trace_returns_exception_v18_regression', icon: Activity },
  { label: 'Run diff', href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression', icon: GitBranch },
  { label: 'Replay', href: '/sandbox/replay/trace_returns_exception_v18_regression', icon: PlaySquare },
  { label: 'Executive', href: '/sandbox/executive', icon: BarChart3 },
];

function isDismissedInBrowser(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(DISMISSED_KEY) === 'true';
}

export function SandboxQuickBar({ links = defaultLinks }: { links?: QuickLink[] }) {
  const dismissed = isDismissedInBrowser();

  if (dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur-xl"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 92%, var(--background))',
      }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">
        Sandbox
      </span>
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <SegmentAwareLink
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
          >
            <Icon className="h-3.5 w-3.5 text-tenant-accent" />
            <span style={{ color: 'var(--tenant-text-primary)' }}>{link.label}</span>
          </SegmentAwareLink>
        );
      })}
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(DISMISSED_KEY, 'true');
          window.location.reload();
        }}
        className="ml-1 rounded-md p-1 transition-colors hover:bg-white/[0.06]"
        aria-label="Dismiss sandbox toolbar"
      >
        <X className="h-3.5 w-3.5 text-tenant-text-muted" />
      </button>
    </div>
  );
}
