'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { upsertSegmentInUrl } from '@/lib/segment-url';
import { cn } from '@/lib/utils';
import {
  Activity,
  Beaker,
  Database,
  Settings,
  BarChart3,
  AlertTriangle,
  GitCompare,
  LayoutDashboard,
  GitBranch,
  FileCode2,
  PlaySquare,
  CheckSquare,
  Bell,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Route ownership normalization (Phase A3):
// - Overview: /
// - Investigate: /traces, /diff, /prompts, /replay
// - Improve: /datasets, /evaluators, /experiments
// - Govern: /budgets, /slas, /regressions, /notifications
// - Settings: /settings
//
// Temporary gaps vs target IA:
// - Improve will later add /experiments/compare
// - Overview will later expand to /overview/incidents and /overview/changes
const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Fleet Overview', icon: LayoutDashboard },
      { href: '/executive', label: 'Executive Summary', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Investigate',
    items: [
      { href: '/traces', label: 'Traces', icon: Activity },
      { href: '/diff', label: 'Run Diff', icon: GitBranch },
      { href: '/prompts', label: 'Prompts', icon: FileCode2 },
      { href: '/replay', label: 'Session Replay', icon: PlaySquare },
    ],
  },
  {
    title: 'Improve',
    items: [
      { href: '/datasets', label: 'Datasets', icon: Database },
      { href: '/evaluators', label: 'Evaluators', icon: CheckSquare },
      { href: '/experiments', label: 'Experiments', icon: Beaker },
    ],
  },
  {
    title: 'Govern',
    items: [
      { href: '/budgets', label: 'Budgets', icon: BarChart3 },
      { href: '/slas', label: 'SLAs', icon: AlertTriangle },
      { href: '/regressions', label: 'Regressions', icon: GitCompare },
      { href: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Settings',
    items: [{ href: '/settings', label: 'Workspace Settings', icon: Settings }],
  },
];

function isItemActive(pathname: string, fullHref: string, baseHref: string) {
  if (fullHref === `${baseHref}` || fullHref === `${baseHref}/`) {
    return pathname === baseHref || pathname === `${baseHref}/`;
  }

  return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);

  const isDemo = pathname.startsWith('/demo');
  const baseHref = isDemo ? '/demo' : '';
  const currentSearch = searchParams?.toString() ?? '';

  return (
    <aside
      className="flex w-72 flex-col border-r backdrop-blur-2xl transition-colors duration-300"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--tenant-panel) 78%, transparent)',
      }}
    >
      <div className="flex h-16 items-center border-b px-6" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <Link href={isDemo ? '/demo' : '/'}>
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold" style={{ color: 'var(--tenant-accent)', fontFamily: 'var(--font-heading)' }}>Foxhound</h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Agent Ops Console
            </p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-6 px-4 py-5">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--tenant-text-muted)' }}>
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const fullHref = `${baseHref}${item.href === '/' ? '' : item.href}` || baseHref || '/';
                const navigableHref = upsertSegmentInUrl(`${fullHref}${currentSearch ? `?${currentSearch}` : ''}`, currentSegmentName);
                const isActive = isItemActive(pathname, fullHref, baseHref);

                return (
                  <Link
                    key={`${section.title}-${item.href}`}
                    href={navigableHref}
                    className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all')}
                    style={isActive
                      ? {
                          background: 'var(--tenant-accent-soft)',
                          color: 'var(--tenant-accent)',
                          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--tenant-accent) 18%, transparent)',
                        }
                      : {
                          color: 'var(--tenant-text-secondary)',
                        }}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-4" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <div className="rounded-2xl border p-3 shadow-sm backdrop-blur" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--tenant-text-primary)' }}>Agent operating console</p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--tenant-text-muted)' }}>Overview · Investigate · Improve · Govern</p>
        </div>
      </div>
    </aside>
  );
}
