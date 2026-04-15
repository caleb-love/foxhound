import type { ReactNode } from 'react';
import {
  ActionLink,
  ActionsRow,
  MetricCard as PremiumMetricCard,
  MetricGrid,
  PageContainer,
  PageHeader,
  RecordBody,
  RecordCard as PremiumRecord,
  RecordHeader as PremiumRecordHeader,
  SectionPanel as PremiumPanel,
  StatusBadge as PremiumStatusBadge,
  surfaceStyles as tenantStyles,
} from '@/components/system/page';

export { tenantStyles, MetricGrid, PremiumMetricCard, PremiumRecord, PremiumRecordHeader, PremiumPanel, PremiumStatusBadge };

export function DashboardPage({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </PageContainer>
  );
}

export function SplitPanelLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return <section className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">{main}{side}</section>;
}

export function PremiumBody({ children }: { children: ReactNode }) {
  return <RecordBody>{children}</RecordBody>;
}

export function PremiumActions({ children }: { children: ReactNode }) {
  return <ActionsRow>{children}</ActionsRow>;
}

export function PremiumActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <ActionLink href={href}>{children}</ActionLink>;
}
