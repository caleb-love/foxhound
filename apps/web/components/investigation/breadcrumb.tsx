'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { isSandboxPath, getSandboxRootHref } from '@/lib/sandbox-routes';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  traces: 'Traces',
  diff: 'Run Diff',
  prompts: 'Prompts',
  replay: 'Session Replay',
  datasets: 'Datasets',
  evaluators: 'Evaluators',
  experiments: 'Experiments',
  regressions: 'Regressions',
  sessions: 'Sessions',
};

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const isSandbox = isSandboxPath(pathname);
  const basePath = isSandbox ? getSandboxRootHref() : '';

  // Strip the sandbox prefix to get the logical route
  const logicalPath = isSandbox
    ? pathname.replace(/^\/sandbox/, '')
    : pathname.replace(/^\/(dashboard)?/, '');

  const parts = logicalPath.split('/').filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [];

  let accumulated = basePath;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    accumulated += `/${part}`;

    const label = ROUTE_LABELS[part];
    if (label) {
      crumbs.push({ label, href: accumulated });
    } else if (i > 0) {
      // This is likely an ID segment: show a truncated version
      const parentLabel = ROUTE_LABELS[parts[i - 1]!];
      if (parentLabel) {
        crumbs.push({
          label: part.length > 16 ? `${part.slice(0, 12)}...` : part,
          href: accumulated,
        });
      }
    }
  }

  return crumbs;
}

export function InvestigationBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Investigation breadcrumb"
      className="flex items-center gap-1 text-[12px]"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;

        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {idx > 0 ? (
              <ChevronRight className="h-3 w-3 text-tenant-text-muted" />
            ) : null}
            {isLast ? (
              <span className="font-medium text-tenant-text-primary">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-tenant-text-muted transition-colors hover:text-tenant-text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
