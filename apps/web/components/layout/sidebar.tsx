'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Activity,
  Beaker,
  Database,
  Settings,
  BarChart3,
  AlertTriangle,
  GitCompare,
} from 'lucide-react';

const navItems = [
  { href: '/traces', label: 'Traces', icon: Activity },
  { href: '/experiments', label: 'Experiments', icon: Beaker },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/budgets', label: 'Budgets', icon: BarChart3 },
  { href: '/slas', label: 'SLAs', icon: AlertTriangle },
  { href: '/regressions', label: 'Regressions', icon: GitCompare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  
  // Detect if we're in demo mode
  const isDemo = pathname.startsWith('/demo');
  const baseHref = isDemo ? '/demo' : '';

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={isDemo ? '/demo' : '/'}>
          <h1 className="text-xl font-bold text-indigo-600">Foxhound</h1>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const fullHref = `${baseHref}${item.href}`;
          const isActive = pathname.startsWith(fullHref);
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-gray-500">
          Agent Observability Platform
        </p>
      </div>
    </aside>
  );
}
