'use client';

import type { DatasetItemListResponse, DatasetWithCount } from '@foxhound/api-client';
import { ActionCard, DetailActionPanel, DetailHeader, EvidenceCard, SummaryStatCard, StatusBadge } from '@/components/system/detail';

interface DatasetDetailViewProps {
  dataset: DatasetWithCount;
  items: DatasetItemListResponse['data'];
  baseHref?: string;
}

function formatRelativeDayLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function DatasetDetailView({ dataset, items, baseHref = '' }: DatasetDetailViewProps) {
  const traceDerivedCount = items.filter((item) => Boolean(item.sourceTraceId)).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <DetailHeader
            title={dataset.name}
            subtitle={dataset.description?.trim() || 'Inspect dataset items, confirm source-trace lineage, and validate that this dataset still represents the production evidence feeding evaluator and experiment workflows.'}
            primaryBadge={<StatusBadge status={`${dataset.itemCount} item${dataset.itemCount === 1 ? '' : 's'}`} variant="neutral" />}
            secondaryBadge={<StatusBadge status={traceDerivedCount > 0 ? `${traceDerivedCount} trace-derived` : 'manual only'} variant={traceDerivedCount > 0 ? 'healthy' : 'warning'} />}
          />
          <div
            className="rounded-[var(--tenant-radius-panel)] border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Dataset id
            </div>
            <div className="mt-2 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{dataset.id}</div>
          </div>
        </div>

        <DetailActionPanel title="Recommended dataset actions">
          <ActionCard
            href={`${baseHref}/datasets`}
            title="Return to datasets"
            description="Go back to the dataset workbench and compare this evidence set against the rest of your current inventory."
          />
          <ActionCard
            href={`${baseHref}/evaluators`}
            title="Review evaluator coverage"
            description="Confirm the active evaluator set is appropriate for the cases represented in this dataset."
          />
          <ActionCard
            href={`${baseHref}/experiments`}
            title="Launch or inspect experiments"
            description="Use this dataset as the evidence base for candidate prompt or routing experiments."
          />
          <ActionCard
            href={`${baseHref}/traces`}
            title="Return to source traces"
            description="Inspect the original runs feeding this dataset to make sure curation still matches the operational problem."
          />
        </DetailActionPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard label="Dataset id" value={dataset.id} supportingText="Stable dataset identifier." />
        <SummaryStatCard label="Created" value={formatRelativeDayLabel(dataset.createdAt)} supportingText="Dataset creation time relative to now." />
        <SummaryStatCard label="Items" value={String(dataset.itemCount)} supportingText="Recorded cases currently attached to this dataset." />
        <SummaryStatCard label="Trace lineage" value={String(traceDerivedCount)} supportingText="Items carrying a source trace id for evidence inspection." />
      </div>

      <EvidenceCard title="Dataset items">
        {items.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
            This dataset has no visible items yet. Add items manually or curate from traces to turn it into a reusable evaluation asset.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--tenant-radius-panel-tight)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{item.id}</div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                      Added {formatRelativeDayLabel(item.createdAt)}
                    </div>
                  </div>
                  {item.sourceTraceId ? (
                    <StatusBadge status="trace-derived" variant="healthy" />
                  ) : (
                    <StatusBadge status="manual item" variant="warning" />
                  )}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Input</div>
                    <pre className="mt-2 overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-xs whitespace-pre-wrap" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}>
                      {JSON.stringify(item.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Expected output</div>
                    <pre className="mt-2 overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-xs whitespace-pre-wrap" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}>
                      {JSON.stringify(item.expectedOutput ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {item.sourceTraceId ? (
                    <a href={`${baseHref}/traces/${item.sourceTraceId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      Open source trace
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </EvidenceCard>
    </div>
  );
}
