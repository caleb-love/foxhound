'use client';

import { useMemo, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { computeExecutiveVerdict, type FleetMetrics, computeDelta } from '@/lib/verdict-engine';
import type { SparkPoint } from '@/components/charts/chart-types';
import { PageContainer } from '@/components/system/page';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { RagIndicator } from './rag-indicator';
import { MetricStrip, type MetricStripItem } from './metric-strip';
import { DecisionCard } from './decision-card';
import { MetricChip, MetricStrip as CompactMetricStrip } from '@/components/investigation/comparison-bar';
import { ViewModeToggle } from '@/components/charts/view-mode-toggle';

// ---------------------------------------------------------------------------
// Prop Types
// ---------------------------------------------------------------------------

export interface ExecMetricInput {
  label: string;
  value: string;
  numericValue: number;
  previousValue?: number;
  higherIsBetter: boolean;
  tone?: 'default' | 'healthy' | 'warning' | 'critical';
  sparklineData?: SparkPoint[];
}

export interface ExecDecisionInput {
  title: string;
  status: 'on-track' | 'watch' | 'attention';
  evidence: string;
  recommendation: string;
  href: string;
  cta: string;
}

export interface ExecTalkingPoint {
  text: string;
  href?: string;
}

export interface ExecutiveSummaryV2Props {
  fleetMetrics: FleetMetrics;
  metricCards: ExecMetricInput[];
  decisions: ExecDecisionInput[];
  talkingPoints: ExecTalkingPoint[];
  periodLabel?: string;
  generatedAt?: string;
  /** Link to fleet overview (operator view) */
  fleetOverviewHref?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExecutiveSummaryV2({
  fleetMetrics,
  metricCards,
  decisions,
  talkingPoints,
  periodLabel,
  generatedAt,
  fleetOverviewHref,
}: ExecutiveSummaryV2Props) {
  const [readinessView, setReadinessView] = useState('status');
  const filters = useSegmentStore((state) => state.currentFilters);
  const execVerdict = computeExecutiveVerdict(fleetMetrics);

  const metricStripItems: MetricStripItem[] = metricCards.map((card) => ({
    label: card.label,
    value: card.value,
    delta: computeDelta(card.numericValue, card.previousValue, card.higherIsBetter),
    sparklineData: card.sparklineData,
    tone: card.tone,
  }));

  const segmentedDecisionCounts = useMemo(() => {
    const severityBias = filters.severity === 'critical' ? 'attention' : filters.severity === 'warning' ? 'watch' : null;
    if (!severityBias) {
      return {
        onTrack: decisions.filter((item) => item.status === 'on-track').length,
        watch: decisions.filter((item) => item.status === 'watch').length,
        attention: decisions.filter((item) => item.status === 'attention').length,
      };
    }

    return {
      onTrack: 0,
      watch: decisions.filter((item) => item.status === 'watch' || severityBias === 'watch').length,
      attention: decisions.filter((item) => item.status === 'attention' || severityBias === 'attention').length,
    };
  }, [decisions, filters.severity]);

  return (
    <PageContainer>
      {/* 1. RAG Indicator (the hero) */}
      <RagIndicator
        verdict={execVerdict}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      {/* 2. Key numbers strip */}
      <MetricStrip items={metricStripItems} />

      <div className="space-y-3">
        <ViewModeToggle
          label="Candidate readiness view"
          value={readinessView}
          options={[
            { value: 'status', label: 'Status mix' },
            { value: 'risk', label: 'Risk framing' },
          ]}
          onChange={setReadinessView}
        />
        <CompactMetricStrip>
          <MetricChip label="On track" value={String(segmentedDecisionCounts.onTrack)} accent="success" />
          <MetricChip label="Watch" value={String(segmentedDecisionCounts.watch)} accent="warning" />
          <MetricChip label="Attention" value={String(segmentedDecisionCounts.attention)} accent="danger" />
          <MetricChip label={readinessView === 'status' ? 'Ready now' : 'Blocked'} value={String(readinessView === 'status' ? segmentedDecisionCounts.onTrack : segmentedDecisionCounts.watch + segmentedDecisionCounts.attention)} accent={readinessView === 'status' ? 'success' : 'warning'} />
        </CompactMetricStrip>
      </div>

      {/* 3. Decision cards */}
      <div role="region" aria-label="Decisions requiring review">
        <h2
          className="mb-3 text-base font-semibold text-tenant-text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Decisions
        </h2>
        <div className="space-y-3">
          {decisions.map((decision) => (
            <DecisionCard
              key={decision.title}
              title={decision.title}
              status={decision.status}
              evidence={decision.evidence}
              recommendation={decision.recommendation}
              href={decision.href}
              cta={decision.cta}
            />
          ))}
        </div>
      </div>

      {/* 4. Cross-link to Fleet Overview */}
      {fleetOverviewHref ? (
        <div className="flex items-center justify-end">
          <SegmentAwareLink
            href={fleetOverviewHref}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/5"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-tenant-text-muted" />
            <span style={{ color: 'var(--tenant-text-secondary)' }}>Fleet overview (operator view)</span>
          </SegmentAwareLink>
        </div>
      ) : null}

      {/* 5. Talking points (compact bullets) */}
      {talkingPoints.length > 0 ? (
        <div
          className="rounded-xl border px-5 py-4"
          style={{
            borderColor: 'var(--tenant-panel-stroke)',
            background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
          }}
        >
          <h2
            className="mb-2 text-sm font-semibold text-tenant-text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Talking points
          </h2>
          <ul className="space-y-1.5">
            {talkingPoints.map((point) => (
              <li key={point.text} className="flex gap-2 text-[13px] leading-relaxed text-tenant-text-secondary">
                <span className="mt-1 shrink-0 text-tenant-text-muted">•</span>
                <span>
                  {point.text}
                  {point.href ? (
                    <a
                      href={point.href}
                      className="ml-1 text-tenant-accent hover:underline"
                    >
                      View details
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PageContainer>
  );
}
