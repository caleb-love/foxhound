import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DemoPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1600px] flex-col gap-6', className)}>
      {children}
    </div>
  );
}

export function DemoHero({
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
  return (
    <section
      className="relative overflow-hidden p-8"
      style={{
        borderRadius: 'calc(var(--tenant-radius-panel) + 0.5rem)',
        border: '1px solid var(--tenant-panel-stroke)',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-panel) 94%, transparent), color-mix(in srgb, var(--tenant-panel) 74%, transparent))',
        boxShadow: 'var(--tenant-shadow-hero)',
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--tenant-accent) 22%, transparent), transparent 26%), radial-gradient(circle at top right, color-mix(in srgb, var(--tenant-success) 12%, transparent), transparent 22%)' }} />
      <div className="relative space-y-4">
        <div className="inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ borderRadius: 'var(--tenant-radius-pill)', border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-accent-soft)', color: 'var(--tenant-accent)' }}>
          {eyebrow}
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: 'var(--tenant-text-primary)' }}>{title}</h1>
          <p className="max-w-3xl text-sm leading-7 sm:text-base" style={{ color: 'var(--tenant-text-secondary)' }}>{description}</p>
        </div>
        {children ? <div className="flex flex-wrap gap-3 pt-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function DemoPill({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur" style={{ borderRadius: 'var(--tenant-radius-pill)', border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
      {children}
    </div>
  );
}

export function DemoPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('backdrop-blur-xl', className)} style={{ borderRadius: 'calc(var(--tenant-radius-panel) + 0.25rem)', border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
      {children}
    </div>
  );
}
