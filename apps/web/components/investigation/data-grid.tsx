'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataGridProps {
  children: ReactNode;
  className?: string;
}

interface DataGridSectionProps {
  children: ReactNode;
  className?: string;
}

interface DataGridRowProps {
  columns: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface DataGridCellProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function gridStyle(columns: string, style?: CSSProperties): CSSProperties {
  return {
    gridTemplateColumns: columns,
    ...style,
  };
}

export function DataGrid({ children, className }: DataGridProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-xl border', className)}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--card)',
        boxShadow: 'var(--tenant-shadow-panel)',
      }}
    >
      {children}
    </div>
  );
}

export function DataGridHeader({ columns, children, className, style }: DataGridRowProps) {
  return (
    <div
      className={cn('grid items-center border-b px-4 py-2.5', className)}
      style={{
        ...gridStyle(columns, style),
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 78%, var(--background))',
      }}
    >
      {children}
    </div>
  );
}

export function DataGridBody({ children, className }: DataGridSectionProps) {
  return (
    <div
      className={cn('divide-y', className)}
      style={{ borderColor: 'color-mix(in srgb, var(--tenant-panel-stroke) 60%, transparent)' }}
    >
      {children}
    </div>
  );
}

export function DataGridRow({ columns, children, className, style }: DataGridRowProps) {
  return (
    <div
      className={cn(
        'group/row relative grid items-center px-4 py-3 text-[13px] transition-colors',
        'hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_5%,transparent)]',
        'aria-[selected=true]:bg-[color:color-mix(in_srgb,var(--tenant-accent)_10%,transparent)]',
        className,
      )}
      style={gridStyle(columns, style)}
    >
      {/* Selected indicator stripe — fitted left edge, not full bg. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 transition-transform duration-150 ease-out group-aria-[selected=true]/row:scale-y-100"
        style={{ background: 'var(--tenant-accent)' }}
      />
      {children}
    </div>
  );
}

export function DataGridFooter({ children, className }: DataGridSectionProps) {
  return (
    <div
      className={cn(
        'border-t px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-tenant-text-muted',
        className,
      )}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 78%, var(--background))',
      }}
    >
      {children}
    </div>
  );
}

export function DataGridHead({ children, className }: DataGridCellProps) {
  return (
    <span
      className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.16em] text-tenant-text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DataGridCell({ children, className, style }: DataGridCellProps) {
  return (
    <div className={cn('min-w-0', className)} style={style}>
      {children}
    </div>
  );
}
