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
      <div className="space-y-8">
        <header className="space-y-3">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--tenant-text-muted)' }}
          >
            <span aria-hidden className="inline-block h-[2px] w-6" style={{ background: 'var(--tenant-accent)' }} />
            <span style={{ color: 'var(--tenant-accent)' }}>Investigate</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Run comparison cockpit</span>
          </span>
          <h1
            className="text-[34px] font-semibold leading-[1.1] tracking-tight text-tenant-text-primary"
            style={{ fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui' }}
          >
            Run Diff
          </h1>
          <p className="max-w-[78ch] text-[14px] leading-[1.55] text-tenant-text-secondary">
            Compare two trace runs side-by-side. Pick a pair from the trace list, or use the
            suggested seeded pair to walk a real failure-vs-healthy comparison.
          </p>
        </header>

        <PageWarningState
          title="Select two traces to compare"
          message="Go to the trace list and select two runs, or use a suggested pair below."
        />
        <div className="flex flex-wrap items-center gap-2">
          {suggestedHref ? (
            <Link
              href={suggestedHref}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[13px] font-medium transition-colors hover:brightness-110"
              style={{
                borderColor: 'var(--tenant-accent)',
                background: 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))',
                color: 'var(--tenant-accent)',
              }}
            >
              Compare suggested pair (error vs healthy)
            </Link>
          ) : null}
          <Link
            href="/sandbox/traces"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[13px] font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
            style={{
              borderColor: 'var(--tenant-panel-stroke)',
              color: 'var(--tenant-text-secondary)',
            }}
          >
            Open trace list
          </Link>
        </div>
      </div>
    );
  }

  const [traceA, traceB] = await Promise.all([getTrace(a), getTrace(b)]);

  if (!traceA || !traceB) {
    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--tenant-text-muted)' }}
          >
            <span aria-hidden className="inline-block h-[2px] w-6" style={{ background: 'var(--tenant-accent)' }} />
            <span style={{ color: 'var(--tenant-accent)' }}>Investigate</span>
          </span>
          <h1
            className="text-[34px] font-semibold leading-[1.1] tracking-tight text-tenant-text-primary"
            style={{ fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui' }}
          >
            Run Diff
          </h1>
        </header>
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
