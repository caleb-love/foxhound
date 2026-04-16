'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { cn } from '@/lib/utils';

export const surfaceStyles = {
  panel: {
    borderRadius: 'calc(var(--tenant-radius-panel) + 0.25rem)',
    border: '1px solid var(--tenant-panel-stroke)',
    background: 'var(--card)',
    boxShadow: 'var(--tenant-shadow-panel)',
  } as const,
  panelAlt: {
    borderRadius: 'calc(var(--tenant-radius-panel) - 0.25rem)',
    border: '1px solid var(--tenant-panel-stroke)',
    background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
  } as const,
  action: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--tenant-radius-button)',
    border: '1px solid var(--tenant-panel-stroke)',
    background: 'color-mix(in srgb, var(--card) 84%, var(--background))',
    color: 'var(--tenant-text-primary)',
  } as const,
};

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-8', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm"
          style={{
            borderColor: 'var(--tenant-panel-stroke)',
            background: 'color-mix(in srgb, var(--card) 84%, var(--background))',
            color: 'var(--tenant-accent)',
          }}
        >
          {eyebrow}
        </div>
        <Badge variant="outline">Segment: {currentSegmentName}</Badge>
        {children}
      </div>
      <div className="space-y-2">
        <h1
          className="text-3xl font-semibold tracking-tight text-tenant-text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-tenant-text-secondary">
          {description}
        </p>
      </div>
    </header>
  );
}

export function SectionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-3xl p-5 backdrop-blur-xl', className)} style={surfaceStyles.panel}>
      <div className="space-y-1 pb-4">
        <h2 className="text-xl font-semibold text-tenant-text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
          {title}
        </h2>
        <p className="text-sm text-tenant-text-secondary">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

export function MetricCard({
  label,
  value,
  supportingText,
  className,
  children,
}: {
  label: string;
  value: string;
  supportingText: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex h-full flex-col rounded-3xl p-5 backdrop-blur-xl', className)} style={surfaceStyles.panel}>
      <div className="text-sm text-tenant-text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-tenant-text-primary">{value}</div>
      <p className="mt-3 text-sm leading-6 text-tenant-text-secondary">{supportingText}</p>
      {children}
    </div>
  );
}

export function RecordCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('rounded-2xl border p-4 transition-colors', className)}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RecordHeader({ title, badge, meta }: { title: string; badge?: ReactNode; meta?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="font-medium text-tenant-text-primary">{title}</div>
        {meta ? <div className="mt-1 text-xs text-tenant-text-muted">{meta}</div> : null}
      </div>
      {badge}
    </div>
  );
}

export function RecordBody({ children }: { children: ReactNode }) {
  return <div className="text-sm leading-6 text-tenant-text-secondary">{children}</div>;
}

export function ActionsRow({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">{children}</div>;
}

export function ActionLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <SegmentAwareLink href={href} className={cn('rounded-xl border px-3 py-2 transition-colors hover:bg-muted/30', className)}>
      <span style={surfaceStyles.action}>{children}</span>
    </SegmentAwareLink>
  );
}

export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: 'healthy' | 'warning' | 'critical' | 'neutral';
}) {
  const badgeVariant = variant === 'critical'
    ? 'destructive'
    : variant === 'warning'
      ? 'default'
      : variant === 'healthy'
        ? 'secondary'
        : 'outline';

  return <Badge variant={badgeVariant}>{status}</Badge>;
}
