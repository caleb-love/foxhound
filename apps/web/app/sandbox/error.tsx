'use client';

import { useEffect } from 'react';

export default function SandboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sandbox] Route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        className="rounded-2xl border px-8 py-10 backdrop-blur-xl"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'var(--tenant-panel)',
          boxShadow: 'var(--tenant-shadow-panel)',
          maxWidth: '32rem',
        }}
      >
        <div
          className="text-sm font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--tenant-danger, #f87171)' }}
        >
          Sandbox error
        </div>
        <h2
          className="mt-3 text-xl font-bold"
          style={{ color: 'var(--tenant-text-primary)' }}
        >
          Something went wrong
        </h2>
        <p
          className="mt-2 text-sm leading-6"
          style={{ color: 'var(--tenant-text-secondary)' }}
        >
          The sandbox encountered an unexpected error. This is demo mode, so no
          data was lost. Try reloading the page or navigating back to the overview.
        </p>
        {error.message ? (
          <pre
            className="mt-4 max-h-24 overflow-auto rounded-lg border p-3 text-left font-mono text-xs"
            style={{
              borderColor: 'var(--tenant-panel-stroke)',
              background: 'var(--tenant-panel-alt)',
              color: 'var(--tenant-text-muted)',
            }}
          >
            {error.message}
          </pre>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--tenant-accent)',
              background: 'var(--tenant-accent)',
              color: '#0B1120',
            }}
          >
            Try again
          </button>
          <a
            href="/sandbox"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--tenant-panel-stroke)',
              color: 'var(--tenant-text-primary)',
            }}
          >
            Back to overview
          </a>
        </div>
      </div>
    </div>
  );
}
