'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionLink, ActionsRow, RecordBody, RecordCard, RecordHeader, StatusBadge } from '@/components/system/page';
import { cn } from '@/lib/utils';

export function DetailHeader({
  title,
  subtitle,
  primaryBadge,
  secondaryBadge,
}: {
  title: string;
  subtitle: string;
  primaryBadge?: ReactNode;
  secondaryBadge?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          className="text-[32px] font-semibold leading-[1.1] tracking-tight text-tenant-text-primary"
          style={{ fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui' }}
        >
          {title}
        </h1>
        {primaryBadge}
        {secondaryBadge}
      </div>
      <p className="max-w-[78ch] text-[14px] leading-[1.55] text-tenant-text-secondary">{subtitle}</p>
    </div>
  );
}

export function DetailActionPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

export function ActionCard({
  href,
  title,
  description,
  disabled = false,
}: {
  href: string;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <ActionLink
      href={href}
      className={cn('block rounded-lg border p-3 transition-colors', disabled ? 'pointer-events-none opacity-60' : 'hover:bg-muted/40')}
    >
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </ActionLink>
  );
}

export function SummaryStatCard({
  label,
  value,
  supportingText,
}: {
  label: string;
  value: string;
  supportingText?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-tenant-text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="text-[26px] font-semibold leading-none tracking-tight text-tenant-text-primary"
          style={{
            fontFamily:
              'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {supportingText ? (
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-tenant-text-muted">{supportingText}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CompareContextCard({
  label,
  id,
  meta,
}: {
  label: string;
  id: string;
  meta: string[];
}) {
  return (
    <RecordCard>
      <RecordHeader title={label} />
      <RecordBody>
        <div className="font-mono text-sm text-tenant-text-primary">{id}</div>
        <div className="mt-2 space-y-1 text-xs text-tenant-text-secondary">
          {meta.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </div>
      </RecordBody>
    </RecordCard>
  );
}

export function EvidenceCard({
  title,
  children,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export { ActionsRow, StatusBadge };
