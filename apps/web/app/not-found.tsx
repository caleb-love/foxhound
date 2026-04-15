import Link from 'next/link';

const clues = [
  'We searched the trace tree, the replay index, and the prompt history. This route never emitted.',
  'No span found for this pathname. Status: not_found. Root cause: user navigated into an alternate timeline.',
  'If this were a production agent incident, Session Replay would already be open and someone would be blaming a prompt rollout.',
  'The good news: this 404 is fully reproducible. The bad news: there is no healthy baseline to diff against.',
];

export default function NotFound() {
  const clue = clues[0];

  return (
    <main className="min-h-screen px-6 py-16" style={{ background: 'radial-gradient(circle at top, var(--tenant-app-bg-accent-a) 0%, transparent 28%), var(--tenant-app-bg)', color: 'var(--tenant-text-primary)' }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-[2rem] border p-10 backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-hero)' }}>
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-muted)' }}>
            404 · route observability report
          </div>
          <div className="mt-5 space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight" style={{ color: 'var(--tenant-text-primary)' }}>This route never made it to production.</h1>
            <p className="max-w-3xl text-base leading-7" style={{ color: 'var(--tenant-text-secondary)' }}>
              {clue}
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'Open Fleet Overview', href: '/sandbox', cta: 'Inspect sandbox workspace' },
              { title: 'Review Traces', href: '/sandbox/traces', cta: 'Check recent runs' },
              { title: 'Open Session Replay', href: '/sandbox/replay', cta: 'Reconstruct state' },
              { title: 'Compare Regressions', href: '/sandbox/regressions', cta: 'Find the root cause' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border p-4 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                <div className="space-y-2">
                  <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{item.title}</div>
                  <div className="text-sm" style={{ color: 'var(--tenant-accent)' }}>{item.cta}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
            <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--tenant-text-muted)' }}>Likely root causes</div>
            <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: 'var(--tenant-text-secondary)' }}>
              <li>• The link points to a route that was imagined confidently but never implemented.</li>
              <li>• A pathname changed and nobody updated the baseline.</li>
              <li>• This page exists in a parallel branch where the deploy also &quot;definitely worked on localhost&quot;.</li>
            </ul>
          </div>
          <div className="rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-text-primary) 92%, black)', color: 'color-mix(in srgb, white 96%, transparent)', boxShadow: 'var(--tenant-shadow-panel)' }}>
            <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'color-mix(in srgb, white 65%, transparent)' }}>Operator note</div>
            <pre className="mt-4 overflow-auto rounded-2xl p-4 text-xs leading-6" style={{ background: 'color-mix(in srgb, black 20%, transparent)', color: 'color-mix(in srgb, white 90%, transparent)' }}>status: not_found
route: unresolved
suggested_action: inspect navigation, compare against intended information architecture, then ship the fix with evidence
confidence: high</pre>
          </div>
        </section>
      </div>
    </main>
  );
}
