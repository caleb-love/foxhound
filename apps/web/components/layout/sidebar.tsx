'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { upsertSegmentInUrl } from '@/lib/segment-url';
import { getSandboxRootHref, getSandboxRunDiffHref, isSandboxPath } from '@/lib/sandbox-routes';
import { cn } from '@/lib/utils';
import {
  Activity,
  Beaker,
  Database,
  BarChart3,
  AlertTriangle,
  GitCompare,
  LayoutDashboard,
  GitBranch,
  FileCode2,
  PlaySquare,
  CheckSquare,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
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

];

function isItemActive(pathname: string, fullHref: string, baseHref: string) {
  if (fullHref === `${baseHref}` || fullHref === `${baseHref}/`) {
    return pathname === baseHref || pathname === `${baseHref}/`;
  }

  return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'foxhound.sidebar.collapsed';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);

  const isSandbox = isSandboxPath(pathname);
  const baseHref = isSandbox ? getSandboxRootHref() : '';
  const currentSearch = searchParams?.toString() ?? '';
  const preservedSearch = new URLSearchParams(currentSearch);
  preservedSearch.delete('a');
  preservedSearch.delete('b');
  preservedSearch.delete('sourceTrace');
  preservedSearch.delete('focus');
  preservedSearch.delete('baseline');
  preservedSearch.delete('comparison');
  preservedSearch.delete('version');
  preservedSearch.delete('versionA');
  preservedSearch.delete('versionB');
  const preservedSearchString = preservedSearch.toString();

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (storedValue === 'true') {
      const timer = setTimeout(() => setIsCollapsed(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    const timer = setTimeout(() => setIsMobileOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  function toggleCollapsed() {
    setIsCollapsed((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-xl md:hidden"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--sidebar)', color: 'var(--tenant-text-primary)' }}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

    <aside
      className={cn(
        'flex flex-col border-r backdrop-blur-2xl transition-[width,transform,background-color,color] duration-200 ease-out',
        isCollapsed ? 'w-20' : 'w-72',
        // Mobile: fixed overlay sidebar, hidden by default
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:shadow-2xl',
        isMobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
      )}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--sidebar)',
      }}
      aria-label="Primary"
      data-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div className={cn('border-b', isCollapsed ? 'flex h-16 items-center justify-center px-2' : 'flex h-16 items-center justify-between px-5')} style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <Link href={isSandbox ? getSandboxRootHref() : '/'} className={cn('group flex items-center', isCollapsed ? 'justify-center' : 'gap-2.5')} aria-label="Foxhound home">
          <Image
            src="/icon.png"
            alt="Foxhound logo"
            width={192}
            height={192}
            priority
            className="h-11 w-11 object-contain drop-shadow-[0_0_10px_rgba(24,144,255,0.18)] transition-transform duration-200 ease-out group-hover:scale-[1.04]"
          />
          {!isCollapsed ? (
            <div className="flex flex-col justify-center leading-none">
              <span
                className="text-[0.95rem] font-semibold tracking-[0.14em]"
                style={{ color: '#1890FF', fontFamily: 'var(--font-heading)' }}
              >
                FOXHOUND
              </span>
              <span
                className="mt-0.5 text-[0.58rem] font-medium uppercase tracking-[0.18em]"
                style={{ color: 'color-mix(in srgb, #1890FF 50%, var(--tenant-text-muted) 50%)' }}
              >
                Agent Ops Console
              </span>
            </div>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-md transition-[color,background-color,transform] duration-150 ease-out hover:bg-[color:var(--sidebar-accent)] active:scale-95',
            isCollapsed ? 'ml-0 h-6 w-6' : 'h-7 w-7',
          )}
          style={{ color: 'var(--tenant-text-secondary)' }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={isCollapsed}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
      <nav className={cn('flex-1 py-5 transition-[padding] duration-200 ease-out', isCollapsed ? 'space-y-4 px-1' : 'space-y-6 px-4')}>
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            {!isCollapsed ? (
              <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-tenant-text-muted">
                {section.title}
              </div>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const fullHref = isSandbox && item.href === '/diff'
                  ? getSandboxRunDiffHref()
                  : `${baseHref}${item.href === '/' ? '' : item.href}` || baseHref || '/';
                const navigableHref = upsertSegmentInUrl(`${fullHref}${preservedSearchString ? `?${preservedSearchString}` : ''}`, currentSegmentName);
                const isActive = isItemActive(pathname, item.href === '/diff' ? `${baseHref}/diff` : fullHref, baseHref);

                return (
                  <Link
                    key={`${section.title}-${item.href}`}
                    href={navigableHref}
                    className={cn(
                      'flex text-sm font-medium transition-[padding,gap,background-color,color,box-shadow,border-radius,width,height] duration-200 ease-out',
                      isCollapsed ? 'mx-auto h-12 w-12 items-center justify-center rounded-full p-0' : 'items-center gap-3 rounded-xl px-3 py-2.5',
                    )}
                    style={isActive
                      ? {
                          background: 'color-mix(in srgb, var(--tenant-accent) 18%, var(--sidebar))',
                          color: 'var(--foreground)',
                          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--tenant-accent) 42%, transparent)',
                        }
                      : {
                          color: 'var(--tenant-text-secondary)',
                        }}
                    aria-label={item.label}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 ease-out" />
                    {!isCollapsed ? item.label : <span className="sr-only">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* Mobile close button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(false)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--sidebar-accent)] md:hidden"
        style={{ color: 'var(--tenant-text-secondary)' }}
        aria-label="Close navigation"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
    </>
  );
}
