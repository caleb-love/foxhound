import type { Trace } from '@foxhound/types';
import { RunDiffView } from '@/components/diff/run-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { getRequestUrl } from '@/lib/server-url';
import Link from 'next/link';

interface DiffPageProps {
  searchParams: Promise<{
    a?: string;
    b?: string;
  }>;
}

async function getTrace(id: string): Promise<Trace | null> {
  try {
    const response = await fetch(await getRequestUrl(`/api/sandbox/traces/${id}`), {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const { a, b } = await searchParams;
  const demo = buildLocalReviewDemo();
  const allTraces = demo.allTraces as unknown as Trace[];

  if (!a || !b) {
    // Find a suggested pair: first error trace + first healthy trace
    const errorTrace = allTraces.find((t) => t.spans.some((s) => s.status === 'error'));
    const healthyTrace = allTraces.find((t) => t.spans.every((s) => s.status !== 'error'));
    const suggestedHref = errorTrace && healthyTrace
      ? `/sandbox/diff?a=${errorTrace.id}&b=${healthyTrace.id}`
      : null;

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-tenant-text-primary">Run Diff</h1>
        <PageWarningState
          title="Select two traces to compare"
          message="Go to the trace list and select two runs, or use a suggested pair below."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/sandbox/traces"
            className="rounded-[var(--tenant-radius-control-tight)] border px-4 py-2 text-sm font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
            style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-accent)' }}
          >
            Open trace list
          </Link>
          {suggestedHref ? (
            <Link
              href={suggestedHref}
              className="rounded-[var(--tenant-radius-control-tight)] border px-4 py-2 text-sm font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
              style={{ borderColor: 'var(--tenant-accent)', background: 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))', color: 'var(--tenant-accent)' }}
            >
              Compare suggested pair (error vs healthy)
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const [traceA, traceB] = await Promise.all([getTrace(a), getTrace(b)]);

  if (!traceA || !traceB) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-tenant-text-primary">Run Diff</h1>
        <PageErrorState
          title="Unable to load run diff"
          message="One or both sandbox traces could not be loaded."
          detail="Return to sandbox traces and select the runs again."
        />
      </div>
    );
  }

  return (
    <RunDiffView
      traceA={traceA}
      traceB={traceB}
      backHref="/sandbox/traces"
      availableTraces={allTraces}
    />
  );
}
