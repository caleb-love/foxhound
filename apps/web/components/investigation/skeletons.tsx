/**
 * Investigation surface skeleton loaders.
 * Each skeleton matches the layout of its corresponding redesigned page
 * so the transition from loading to loaded is smooth with no layout shift.
 */

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{ background: 'var(--tenant-panel-stroke)', borderRadius: 6, ...style }}
    />
  );
}

/* ---------- Shared blocks ---------- */

function VerdictBarSkeleton() {
  return (
    <div
      className="rounded-[var(--tenant-radius-panel)] border p-4"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 92%, var(--background))' }}
    >
      <div className="flex items-start gap-3">
        <Bone className="h-8 w-8 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-6 w-80 max-w-full" />
          <Bone className="h-4 w-full max-w-[540px]" style={{ opacity: 0.5 }} />
          <div className="flex gap-2 pt-1">
            <Bone className="h-7 w-24 rounded-md" />
            <Bone className="h-7 w-20 rounded-md" />
            <Bone className="h-7 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-9 w-28 rounded-md" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

/* ---------- Trace Detail skeleton ---------- */

export function TraceDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <Bone className="h-4 w-16" />
      <VerdictBarSkeleton />
      <MetricStripSkeleton count={6} />
      {/* Split pane: waterfall + inspector */}
      <div
        className="flex overflow-hidden rounded-[var(--tenant-radius-panel)] border"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)', minHeight: 400 }}
      >
        <div className="w-[62%] border-r p-3 space-y-1" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          <div className="mb-3 flex items-end justify-between">
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-48" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1" style={{ paddingLeft: i > 0 && i < 6 ? 24 : 0 }}>
              <Bone className="h-2 w-2 rounded-full" />
              <Bone className="h-4 w-32" style={{ opacity: 1 - i * 0.08 }} />
              <div className="flex-1" />
              <Bone className="h-4 rounded-full" style={{ width: `${30 + Math.random() * 50}%`, opacity: 0.4 }} />
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 space-y-3">
          <Bone className="h-5 w-48" />
          <Bone className="h-4 w-32" style={{ opacity: 0.6 }} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-14 rounded-md" style={{ opacity: 0.5 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Run Diff skeleton ---------- */

export function RunDiffSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <Bone className="h-4 w-16" />
      <VerdictBarSkeleton />
      {/* Trace pair strip */}
      <div className="flex items-center gap-3 rounded-[var(--tenant-radius-panel)] border px-4 py-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
        <Bone className="h-5 w-5 rounded-full" />
        <Bone className="h-4 w-40" />
        <Bone className="h-7 w-14 rounded-md" />
        <Bone className="h-5 w-5 rounded-full" />
        <Bone className="h-4 w-40" />
      </div>
      {/* Comparison bars */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 rounded-[var(--tenant-radius-panel)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-5 rounded-full" />
            <Bone className="h-5 rounded-full" style={{ opacity: 0.6 }} />
          </div>
        ))}
      </div>
      {/* Insights */}
      <div className="rounded-[var(--tenant-radius-panel)] border p-4 space-y-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        <Bone className="h-4 w-56" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-16 rounded-md" style={{ opacity: 0.7 - i * 0.15 }} />
        ))}
      </div>
      {/* Waterfall diff */}
      <div className="rounded-[var(--tenant-radius-panel)] border overflow-hidden" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        <div className="border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
          <Bone className="h-4 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-3 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            <Bone className="h-2 w-2 rounded-full" />
            <Bone className="h-3 w-28" />
            <div className="flex-1" />
            <Bone className="h-3.5 rounded" style={{ width: `${20 + Math.random() * 30}%`, opacity: 0.4 }} />
            <Bone className="h-3.5 rounded" style={{ width: `${20 + Math.random() * 30}%`, opacity: 0.4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Replay Index skeleton ---------- */

export function ReplayIndexSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Bone className="h-7 w-20 rounded-full" />
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-96 max-w-full" style={{ opacity: 0.5 }} />
      </div>
      {/* Filters */}
      <Bone className="h-10 w-full rounded-md" />
      <VerdictBarSkeleton />
      <MetricStripSkeleton count={4} />
      {/* Replay rows */}
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border px-3 py-2.5"
            style={{ borderColor: 'var(--tenant-panel-stroke)', opacity: 1 - i * 0.1 }}
          >
            <Bone className="h-4 w-6" />
            <Bone className="h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-1">
              <Bone className="h-4 w-64" />
              <Bone className="h-3 w-48" style={{ opacity: 0.5 }} />
            </div>
            <Bone className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Replay Detail skeleton ---------- */

export function ReplayDetailSkeleton() {
  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] animate-pulse flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 94%, var(--background))' }}>
        <Bone className="h-4 w-16" />
        <Bone className="h-4 w-px" style={{ background: 'var(--tenant-panel-stroke)' }} />
        <Bone className="h-4 w-32" />
        <Bone className="h-5 w-16 rounded" />
      </div>
      {/* Transport controls */}
      <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-7 w-7 rounded" />
          ))}
        </div>
        <Bone className="h-3 w-10" />
        <Bone className="h-2 flex-1 rounded-full" />
        <div className="flex gap-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-5 w-8 rounded" />
          ))}
        </div>
      </div>
      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] border-r p-3 space-y-1" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}>
          <Bone className="h-3 w-24 mb-2" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Bone className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1">
                <Bone className="h-3 w-32" style={{ opacity: 1 - i * 0.08 }} />
                <Bone className="h-2 w-20" style={{ opacity: 0.4 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Bone className="h-24 rounded-md" />
          <Bone className="h-32 rounded-md" style={{ opacity: 0.6 }} />
          <Bone className="h-48 rounded-md" style={{ opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Prompt List skeleton ---------- */

export function PromptListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-2">
        <Bone className="h-7 w-20 rounded-full" />
        <Bone className="h-8 w-32" />
        <Bone className="h-4 w-96 max-w-full" style={{ opacity: 0.5 }} />
      </div>
      <Bone className="h-10 w-full rounded-md" />
      <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        <div className="border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
          <div className="flex justify-between">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--tenant-panel-stroke)', opacity: 1 - i * 0.12 }}>
            <div className="space-y-1">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-56" style={{ opacity: 0.5 }} />
            </div>
            <Bone className="h-3 w-20" />
            <Bone className="h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Prompt Detail skeleton ---------- */

export function PromptDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <Bone className="h-4 w-16" />
      <div className="rounded-[var(--tenant-radius-panel)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 94%, var(--background))' }}>
        <Bone className="h-7 w-48" />
        <div className="mt-2 flex gap-2">
          <Bone className="h-4 w-56" style={{ opacity: 0.5 }} />
          <Bone className="h-4 w-12 rounded" />
        </div>
      </div>
      <MetricStripSkeleton count={3} />
      {/* Split pane */}
      <div className="flex overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)', minHeight: 360 }}>
        <div className="w-[220px] border-r p-3 space-y-1" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 92%, var(--background))' }}>
          <Bone className="h-3 w-28 mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Bone className="h-2 w-2 rounded-full" />
              <Bone className="h-3 w-20" style={{ opacity: 1 - i * 0.15 }} />
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 space-y-3">
          <Bone className="h-6 w-32" />
          <Bone className="h-3 w-48" style={{ opacity: 0.5 }} />
          <Bone className="h-64 rounded-md" style={{ opacity: 0.3 }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Trace List skeleton ---------- */

export function TraceListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-2">
        <Bone className="h-7 w-20 rounded-full" />
        <Bone className="h-8 w-24" />
        <Bone className="h-4 w-96 max-w-full" style={{ opacity: 0.5 }} />
      </div>
      <Bone className="h-10 w-full rounded-md" />
      <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', opacity: 1 - i * 0.08 }}
          >
            <Bone className="h-4 w-4 rounded" />
            <Bone className="h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-1">
              <Bone className="h-4 w-32" />
              <Bone className="h-3 w-20" style={{ opacity: 0.5 }} />
            </div>
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-14" />
            <Bone className="h-3 w-24" />
            <div className="flex gap-1">
              <Bone className="h-7 w-16 rounded-md" />
              <Bone className="h-7 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
