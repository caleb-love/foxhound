'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { upsertSegmentInUrl } from '@/lib/segment-url';
import { getSandboxRootHref, getSandboxRunDiffHref, isSandboxPath } from '@/lib/sandbox-routes';
import {
  LayoutDashboard,
  Activity,
  GitBranch,
  PlaySquare,
  FileCode2,
  Database,
  CheckSquare,
  Beaker,
  BarChart3,
  ShieldAlert,
  GitCompare,
  Bell,
} from 'lucide-react';

interface CommandRoute {
  label: string;
  href: string;
  group: 'Overview' | 'Investigate' | 'Improve' | 'Govern';
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const routes: CommandRoute[] = [
  { label: 'Fleet Overview', href: '/', group: 'Overview', keywords: ['home', 'overview', 'fleet'], icon: LayoutDashboard },
  { label: 'Executive Summary', href: '/executive', group: 'Overview', keywords: ['executive', 'summary', 'leadership', 'stakeholder'], icon: LayoutDashboard },
  { label: 'Traces', href: '/traces', group: 'Investigate', keywords: ['trace', 'runs', 'logs'], icon: Activity },
  { label: 'Run Diff', href: '/diff', group: 'Investigate', keywords: ['compare', 'diff', 'baseline'], icon: GitBranch },
  { label: 'Session Replay', href: '/replay', group: 'Investigate', keywords: ['replay', 'state', 'timeline'], icon: PlaySquare },
  { label: 'Prompts', href: '/prompts', group: 'Investigate', keywords: ['prompt', 'version', 'history'], icon: FileCode2 },
  { label: 'Datasets', href: '/datasets', group: 'Improve', keywords: ['cases', 'dataset', 'eval'], icon: Database },
  { label: 'Evaluators', href: '/evaluators', group: 'Improve', keywords: ['judge', 'scoring', 'evaluator'], icon: CheckSquare },
  { label: 'Experiments', href: '/experiments', group: 'Improve', keywords: ['experiment', 'candidate', 'compare'], icon: Beaker },
  { label: 'Budgets', href: '/budgets', group: 'Govern', keywords: ['cost', 'budget', 'spend'], icon: BarChart3 },
  { label: 'SLAs', href: '/slas', group: 'Govern', keywords: ['sla', 'latency', 'reliability'], icon: ShieldAlert },
  { label: 'Regressions', href: '/regressions', group: 'Govern', keywords: ['regression', 'drift', 'behavior'], icon: GitCompare },
  { label: 'Notifications', href: '/notifications', group: 'Govern', keywords: ['alerts', 'routing', 'notifications'], icon: Bell },
];

export function OperatorCommandPalette() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const groupedRoutes = useMemo(() => {
    const groups = new Map<string, CommandRoute[]>();
    for (const route of routes) {
      const existing = groups.get(route.group) ?? [];
      existing.push(route);
      groups.set(route.group, existing);
    }
    return Array.from(groups.entries());
  }, []);

  const handleSelect = (href: string) => {
    const currentSearch = searchParams?.toString() ?? '';
    const isSandbox = isSandboxPath(pathname);
    const resolvedHref = isSandbox
      ? href === '/diff'
        ? getSandboxRunDiffHref()
        : `${getSandboxRootHref()}${href === '/' ? '' : href}`
      : href;
    const nextUrl = upsertSegmentInUrl(`${resolvedHref}${currentSearch ? `${resolvedHref.includes('?') ? '&' : '?'}${currentSearch}` : ''}`, currentSegmentName);
    router.push(nextUrl);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-muted)' }}
        aria-label="Open operator command palette"
      >
        Quick jump
        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
          ⌘K
        </span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Operator command palette" description="Jump to the main Foxhound workflows quickly.">
        <Command>
          <CommandInput placeholder="Jump to overview, traces, regressions, budgets..." />
          <CommandList>
            <CommandEmpty>No matching workflow found.</CommandEmpty>
            {groupedRoutes.map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.keywords.join(' ')}`}
                      onSelect={() => handleSelect(item.href)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {isActive ? <CommandShortcut>Current</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
