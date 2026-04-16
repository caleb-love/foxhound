import type { ReactNode } from 'react';

interface InvestigationDetailShellProps {
  primary: ReactNode;
  detail: ReactNode;
  detailTitle?: string;
  emptyDetail?: ReactNode;
  layout?: 'split' | 'sidebar';
}

export function InvestigationDetailShell({
  primary,
  detail,
  detailTitle,
  emptyDetail,
  layout = 'split',
}: InvestigationDetailShellProps) {
  if (layout === 'sidebar') {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0">{primary}</div>
        <aside
          className="min-w-0 overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          {detailTitle ? (
            <div
              className="border-b px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}
            >
              {detailTitle}
            </div>
          ) : null}
          {detail}
        </aside>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
      <div className="grid min-h-[400px] lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="min-w-0 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          {primary}
        </div>
        <aside className="min-w-0">
          {detailTitle ? (
            <div
              className="border-b px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}
            >
              {detailTitle}
            </div>
          ) : null}
          {detail || emptyDetail}
        </aside>
      </div>
    </div>
  );
}
