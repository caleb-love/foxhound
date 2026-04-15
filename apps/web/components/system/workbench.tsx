'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SectionPanel, StatusBadge, surfaceStyles } from '@/components/system/page';

export function WorkbenchPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <SectionPanel title={title} description={description}>
      {children}
    </SectionPanel>
  );
}

export function SelectionSummaryBar({
  selectedCount,
  canCompare,
  onClear,
  onCompare,
}: {
  selectedCount: number;
  canCompare: boolean;
  onClear: () => void;
  onCompare: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--tenant-panel-alt)',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 4%, transparent)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={`${selectedCount} selected`} variant="neutral" />
        <span style={{ color: 'var(--tenant-text-secondary)' }}>
          Select two traces to launch a comparison workflow with preserved context.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" onClick={onCompare} disabled={!canCompare}>
          Compare selected traces
        </Button>
      </div>
    </div>
  );
}

export function TableShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={surfaceStyles.panel}>
      {children}
      {footer ? (
        <div className="border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-text-secondary)' }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
