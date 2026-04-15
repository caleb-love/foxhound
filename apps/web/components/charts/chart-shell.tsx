import type { ReactNode } from 'react';
import {
  PremiumActionLink,
  PremiumActions,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
  PremiumStatusBadge,
} from '@/components/sandbox/primitives';
import type { ChartStatusTone } from './chart-types';

function toBadgeVariant(tone: ChartStatusTone | undefined): 'healthy' | 'warning' | 'critical' | 'neutral' {
  if (tone === 'healthy') return 'healthy';
  if (tone === 'warning') return 'warning';
  if (tone === 'critical') return 'critical';
  return 'neutral';
}

export function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PremiumPanel title={title} description={description}>
      {children}
    </PremiumPanel>
  );
}

export function ChartRecord({
  title,
  description,
  status,
  meta,
  href,
  cta,
  badge,
}: {
  title: string;
  description?: ReactNode;
  status?: ChartStatusTone;
  meta?: string;
  href?: string;
  cta?: string;
  badge?: ReactNode;
}) {
  const resolvedBadge = badge ?? (status && status !== 'default' ? (
    <PremiumStatusBadge status={status} variant={toBadgeVariant(status)} />
  ) : undefined);

  return (
    <PremiumRecord>
      <PremiumRecordHeader title={title} meta={meta} badge={resolvedBadge} />
      {description ? <div className="text-sm leading-6" style={{ color: 'var(--tenant-text-secondary)' }}>{description}</div> : null}
      {href && cta ? (
        <PremiumActions>
          <PremiumActionLink href={href}>{cta}</PremiumActionLink>
        </PremiumActions>
      ) : null}
    </PremiumRecord>
  );
}
