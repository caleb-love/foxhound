/**
 * Loading skeletons for the redesigned overview surfaces.
 * Each skeleton matches the layout of its corresponding V2 page so the
 * transition from loading to loaded is smooth with no layout shift.
 */

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{ background: 'var(--tenant-panel-stroke)', borderRadius: 6, ...style }}
    />
  );
}

/* ---------- Fleet Overview V2 skeleton ---------- */

export function FleetOverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Verdict bar */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'color-mix(in srgb, var(--card) 92%, var(--background))', border: '1px solid var(--tenant-panel-stroke)' }}
      >
        <div className="flex items-start gap-3">
          <Bone className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-5 w-96 max-w-full" />
            <Bone className="h-4 w-full max-w-[600px]" style={{ opacity: 0.5 }} />
            <div className="flex gap-2 pt-1">
              <Bone className="h-8 w-36 rounded-lg" />
              <Bone className="h-8 w-28 rounded-lg" />
              <Bone className="h-8 w-24 rounded-lg" />
              <div className="flex-1" />
              <Bone className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Metric strip */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', minWidth: 200 }}
          >
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-20" style={{ opacity: 0.5 }} />
              <div className="flex items-baseline gap-2">
                <Bone className="h-7 w-16" />
                <Bone className="h-4 w-10 rounded-md" style={{ opacity: 0.4 }} />
              </div>
            </div>
            <Bone className="h-6 w-16 rounded" style={{ opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* Action queue */}
      <div
        className="rounded-2xl border"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
      >
        <div className="px-5 pt-4 pb-2">
          <Bone className="h-4 w-24" />
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5" style={{ opacity: 1 - i * 0.15 }}>
              <div className="flex items-start gap-2.5">
                <Bone className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-72 max-w-full" />
                  <Bone className="h-3 w-full max-w-[480px]" style={{ opacity: 0.5 }} />
                  <div className="flex gap-1.5 pt-1">
                    <Bone className="h-6 w-14 rounded-md" />
                    <Bone className="h-6 w-16 rounded-md" />
                    <Bone className="h-6 w-14 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Executive Summary V2 skeleton ---------- */

export function ExecutiveSummarySkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* RAG indicator */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'color-mix(in srgb, var(--card) 92%, var(--background))', border: '1px solid var(--tenant-panel-stroke)' }}
      >
        <div className="flex items-center justify-center gap-3">
          <Bone className="h-5 w-5 rounded-full" />
          <Bone className="h-6 w-20" />
        </div>
        <div className="mx-auto mt-3 space-y-2">
          <Bone className="mx-auto h-5 w-80 max-w-full" />
          <Bone className="mx-auto h-4 w-48" style={{ opacity: 0.5 }} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Bone className="h-3 w-32" style={{ opacity: 0.4 }} />
        </div>
      </div>

      {/* Metric strip */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', minWidth: 200 }}
          >
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-20" style={{ opacity: 0.5 }} />
              <Bone className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Decision cards */}
      <div className="space-y-3">
        <Bone className="h-4 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--tenant-panel-stroke)', borderLeft: '3px solid var(--tenant-panel-stroke)', opacity: 1 - i * 0.15 }}
          >
            <Bone className="h-4 w-16 rounded-md" style={{ opacity: 0.5 }} />
            <Bone className="mt-2 h-4 w-64 max-w-full" />
            <Bone className="mt-2 h-3 w-full max-w-[400px]" style={{ opacity: 0.5 }} />
            <Bone className="mt-2 h-3 w-56" style={{ opacity: 0.6 }} />
            <Bone className="mt-3 h-7 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Talking points */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <Bone className="h-3 w-24 mb-3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2 py-1" style={{ opacity: 1 - i * 0.2 }}>
            <Bone className="mt-1 h-2 w-2 shrink-0 rounded-full" />
            <Bone className="h-3 w-full max-w-[520px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Governance surface skeleton (budgets, SLAs, regressions, notifications) ---------- */

export function GovernanceSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-2">
        <Bone className="h-7 w-20 rounded-full" />
        <Bone className="h-8 w-36" />
        <Bone className="h-4 w-96 max-w-full" style={{ opacity: 0.5 }} />
      </div>
      <Bone className="h-10 w-full rounded-md" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)', opacity: 1 - i * 0.1 }}
          >
            <Bone className="h-3 w-20" style={{ opacity: 0.5 }} />
            <Bone className="mt-3 h-7 w-16" />
            <Bone className="mt-3 h-3 w-full" style={{ opacity: 0.4 }} />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        <div className="border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
          <div className="flex justify-between">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3" style={{ borderColor: 'var(--tenant-panel-stroke)', opacity: 1 - i * 0.12 }}>
            <Bone className="h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-1">
              <Bone className="h-4 w-48" />
              <Bone className="h-3 w-80 max-w-full" style={{ opacity: 0.4 }} />
            </div>
            <Bone className="h-5 w-16 rounded" />
            <Bone className="h-7 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
