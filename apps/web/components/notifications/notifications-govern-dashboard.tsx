'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { DataGrid, DataGridBody, DataGridCell, DataGridFooter, DataGridHead, DataGridHeader, DataGridRow, VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Bell, Settings } from 'lucide-react';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';

export interface NotificationRecord {
  channelId: string;
  channelName: string;
  kind: string;
  status: string;
  summary: string;
  updatedAt?: string;
}

interface NotificationsGovernDashboardProps {
  channels: NotificationRecord[];
  baseHref?: string;
}

const notificationFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search channels...' },
];

export function NotificationsGovernDashboard({ channels, baseHref = '' }: NotificationsGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);
  const defaultDateRange = createDateRangeFromHours(24);
  const hasExplicitDateFilter =
    Math.abs(filters.dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 ||
    Math.abs(filters.dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;

  const filtered = filterByDashboardScope(channels, filters, {
    searchableText: (item) => `${item.channelName} ${item.kind} ${item.summary}`,
    timestampMs: hasExplicitDateFilter ? (item) => (item.updatedAt ? new Date(item.updatedAt).getTime() : undefined) : undefined,
  });

  const healthyCount = channels.filter((c) => c.status === 'healthy').length;
  const degradedCount = channels.filter((c) => c.status !== 'healthy').length;

  const verdictSeverity = channels.length === 0 ? 'info' as const : degradedCount > 0 ? 'warning' as const : 'success' as const;
  const verdictHeadline = channels.length === 0
    ? 'No notification channels'
    : `${channels.length} channel${channels.length !== 1 ? 's' : ''} configured, ${healthyCount} healthy`;
  const verdictSummary = channels.length === 0
    ? 'Add a Slack channel or webhook to start receiving alerts.'
    : degradedCount > 0
      ? `${degradedCount} channel${degradedCount !== 1 ? 's' : ''} showing degraded status. Check connectivity.`
      : 'All channels operational. Alerts will route to the configured destinations.';

  return (
    <PageContainer>
      <PageHeader eyebrow="Govern" title="Notifications" description="Configure alert channels and routing rules. Test delivery and monitor channel health." />

      <DashboardFilterBar definitions={notificationFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/notifications`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              Add channel
            </InlineAction>
            <InlineAction href={`${baseHref}/notifications`} variant="secondary">
              <Bell className="h-3.5 w-3.5" />
              Test send
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Channels" value={String(channels.length)} />
        <MetricChip label="Healthy" value={String(healthyCount)} accent="success" />
        {degradedCount > 0 ? <MetricChip label="Degraded" value={String(degradedCount)} accent="warning" /> : null}
      </MetricStrip>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {channels.length === 0 ? 'Add your first notification channel.' : 'No channels match the current filter.'}
          </p>
        </div>
      ) : (
        <DataGrid>
          <DataGridHeader columns="minmax(0,1fr) 88px 88px 68px">
            <DataGridHead>Channel</DataGridHead>
            <DataGridHead className="text-center">Type</DataGridHead>
            <DataGridHead className="text-center">Status</DataGridHead>
            <DataGridHead className="sr-only">Actions</DataGridHead>
          </DataGridHeader>

          <DataGridBody>
            {filtered.map((channel) => (
              <DataGridRow key={channel.channelId} columns="minmax(0,1fr) 88px 88px 68px">
                <DataGridCell>
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 shrink-0 text-tenant-accent" />
                    <span className="truncate text-sm font-semibold text-tenant-text-primary">{channel.channelName}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{channel.summary}</div>
                </DataGridCell>

                <DataGridCell className="text-center">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize" style={{ background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)', border: '1px solid var(--tenant-panel-stroke)' }}>
                    {channel.kind}
                  </span>
                </DataGridCell>

                <DataGridCell className="text-center">
                  <div
                    className="mx-auto h-2 w-2 rounded-full"
                    style={{ background: channel.status === 'healthy' ? 'var(--tenant-success)' : channel.status === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-danger)' }}
                  />
                </DataGridCell>

                <DataGridCell className="flex items-center justify-end whitespace-nowrap">
                  <InlineAction href={`${baseHref}/notifications`} variant="ghost" className="text-[11px] px-2 py-0.5">
                    <Settings className="h-3 w-3" />
                  </InlineAction>
                </DataGridCell>
              </DataGridRow>
            ))}
          </DataGridBody>

          <DataGridFooter>
            {filtered.length} channel{filtered.length !== 1 ? 's' : ''}
          </DataGridFooter>
        </DataGrid>
      )}
    </PageContainer>
  );
}
