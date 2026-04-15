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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        {primaryBadge}
        {secondaryBadge}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
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
        <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{value}</div>
        {supportingText ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{supportingText}</p>
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
        <div className="font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{id}</div>
        <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--tenant-text-secondary)' }}>
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
