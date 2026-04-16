export default function SandboxLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-full" style={{ background: 'var(--tenant-panel-stroke)' }} />
          <div className="h-7 w-32 rounded-full" style={{ background: 'var(--tenant-panel-stroke)' }} />
        </div>
        <div className="h-8 w-72 rounded-lg" style={{ background: 'var(--tenant-panel-stroke)' }} />
        <div className="h-5 w-[480px] max-w-full rounded-lg" style={{ background: 'var(--tenant-panel-stroke)', opacity: 0.6 }} />
      </div>

      {/* Metric grid skeleton */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-3xl p-5 backdrop-blur-xl"
            style={{
              border: '1px solid var(--tenant-panel-stroke)',
              background: 'var(--tenant-panel)',
              boxShadow: 'var(--tenant-shadow-panel)',
              minHeight: '160px',
            }}
          >
            <div className="h-4 w-24 rounded" style={{ background: 'var(--tenant-panel-stroke)' }} />
            <div className="mt-4 h-8 w-16 rounded" style={{ background: 'var(--tenant-panel-stroke)' }} />
            <div className="mt-4 h-4 w-full rounded" style={{ background: 'var(--tenant-panel-stroke)', opacity: 0.5 }} />
            <div className="mt-2 h-4 w-3/4 rounded" style={{ background: 'var(--tenant-panel-stroke)', opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* Content panel skeleton */}
      <div
        className="rounded-3xl p-6 backdrop-blur-xl"
        style={{
          border: '1px solid var(--tenant-panel-stroke)',
          background: 'var(--tenant-panel)',
          boxShadow: 'var(--tenant-shadow-panel)',
          minHeight: '320px',
        }}
      >
        <div className="h-5 w-48 rounded" style={{ background: 'var(--tenant-panel-stroke)' }} />
        <div className="mt-2 h-4 w-72 rounded" style={{ background: 'var(--tenant-panel-stroke)', opacity: 0.5 }} />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}
            >
              <div className="h-4 w-64 rounded" style={{ background: 'var(--tenant-panel-stroke)' }} />
              <div className="mt-2 h-3 w-full rounded" style={{ background: 'var(--tenant-panel-stroke)', opacity: 0.4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
