'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Trace, Span } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MetricsDelta } from './metrics-delta';
import { TimelineDiff } from './timeline-diff';
import { InsightsPanel } from './insights-panel';

interface RunDiffViewProps {
  traceA: Trace;
  traceB: Trace;
  backHref?: string;
}

type SpanFingerprint = {
  name: string;
  kind: string;
  occurrence: number;
};

function buildSpanFingerprintKey({ name, kind, occurrence }: SpanFingerprint): string {
  return `${kind}:${name}:${occurrence}`;
}

function getSpanFingerprint(trace: Trace, span: Span): string {
  let occurrence = 0;

  for (const candidate of trace.spans) {
    if (candidate.kind === span.kind && candidate.name === span.name) {
      occurrence += 1;
    }

    if (candidate.spanId === span.spanId) {
      return buildSpanFingerprintKey({ name: span.name, kind: span.kind, occurrence });
    }
  }

  return buildSpanFingerprintKey({ name: span.name, kind: span.kind, occurrence: 1 });
}

export function RunDiffView({ traceA, traceB, backHref = '/traces' }: RunDiffViewProps) {
  // Calculate metrics
  const metrics = useMemo(() => {
    // Cost calculation
    const costA = traceA.spans.reduce((sum, span) => {
      const cost = span.attributes.cost as number | undefined;
      return sum + (cost || 0);
    }, 0);
    
    const costB = traceB.spans.reduce((sum, span) => {
      const cost = span.attributes.cost as number | undefined;
      return sum + (cost || 0);
    }, 0);
    
    const costDelta = costB - costA;
    const costPercentage = costA > 0 ? ((costDelta / costA) * 100) : 0;
    
    // Duration calculation
    const durationA = traceA.endTimeMs
      ? (traceA.endTimeMs - traceA.startTimeMs) / 1000
      : 0;
    const durationB = traceB.endTimeMs
      ? (traceB.endTimeMs - traceB.startTimeMs) / 1000
      : 0;
    
    const durationDelta = durationB - durationA;
    const durationPercentage = durationA > 0 ? ((durationDelta / durationA) * 100) : 0;
    
    // Span count
    const spanCountA = traceA.spans.length;
    const spanCountB = traceB.spans.length;
    const spanDelta = spanCountB - spanCountA;
    
    // Error count
    const errorsA = traceA.spans.filter(s => s.status === 'error').length;
    const errorsB = traceB.spans.filter(s => s.status === 'error').length;
    const errorDelta = errorsB - errorsA;
    
    return {
      cost: { valueA: costA, valueB: costB, delta: costDelta, percentage: costPercentage },
      duration: { valueA: durationA, valueB: durationB, delta: durationDelta, percentage: durationPercentage },
      spans: { valueA: spanCountA, valueB: spanCountB, delta: spanDelta },
      errors: { valueA: errorsA, valueB: errorsB, delta: errorDelta },
    };
  }, [traceA, traceB]);
  
  // Span diff computation
  const spanDiff = useMemo(() => {
    // Map spans by name for comparison
    const spansAMap = new Map(traceA.spans.map((span) => [getSpanFingerprint(traceA, span), span]));
    const spansBMap = new Map(traceB.spans.map((span) => [getSpanFingerprint(traceB, span), span]));
    
    const added: Span[] = [];
    const removed: Span[] = [];
    const modified: Span[] = [];
    const unchanged: Span[] = [];
    
    // Check what's in B
    spansBMap.forEach((spanB, fingerprint) => {
      const spanA = spansAMap.get(fingerprint);
      
      if (!spanA) {
        // Only in B = added
        added.push(spanB);
      } else {
        // In both - check if modified
        const durationA = spanA.endTimeMs ? spanA.endTimeMs - spanA.startTimeMs : 0;
        const durationB = spanB.endTimeMs ? spanB.endTimeMs - spanB.startTimeMs : 0;
        const costA = (spanA.attributes.cost as number) || 0;
        const costB = (spanB.attributes.cost as number) || 0;
        
        if (Math.abs(durationB - durationA) > 100 || Math.abs(costB - costA) > 0.001) {
          modified.push(spanB);
        } else {
          unchanged.push(spanB);
        }
      }
    });
    
    // Check what's only in A
    spansAMap.forEach((spanA, fingerprint) => {
      if (!spansBMap.has(fingerprint)) {
        removed.push(spanA);
      }
    });
    
    return { added, removed, modified, unchanged };
  }, [traceA, traceB]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Traces
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Run Diff</h1>
            <p className="text-sm text-gray-500 mt-1">
              Comparing {traceA.agentId} traces
            </p>
          </div>
        </div>
      </div>
      
      {/* Trace IDs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Baseline (A)</div>
          <div className="font-mono text-sm">{traceA.id}</div>
          <div className="mt-2 text-xs text-gray-600">
            Agent: {traceA.agentId}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Comparison (B)</div>
          <div className="font-mono text-sm">{traceB.id}</div>
          <div className="mt-2 text-xs text-gray-600">
            Agent: {traceB.agentId}
          </div>
        </div>
      </div>
      
      {/* Metrics Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <MetricsDelta
          label="Cost"
          valueA={metrics.cost.valueA}
          valueB={metrics.cost.valueB}
          delta={metrics.cost.delta}
          percentage={metrics.cost.percentage}
          format="currency"
        />
        <MetricsDelta
          label="Duration"
          valueA={metrics.duration.valueA}
          valueB={metrics.duration.valueB}
          delta={metrics.duration.delta}
          percentage={metrics.duration.percentage}
          format="duration"
        />
        <MetricsDelta
          label="Spans"
          valueA={metrics.spans.valueA}
          valueB={metrics.spans.valueB}
          delta={metrics.spans.delta}
          format="number"
        />
        <MetricsDelta
          label="Errors"
          valueA={metrics.errors.valueA}
          valueB={metrics.errors.valueB}
          delta={metrics.errors.delta}
          format="number"
          lowerIsBetter
        />
      </div>
      
      {/* Insights */}
      <InsightsPanel
        costDelta={metrics.cost.delta}
        costPercentage={metrics.cost.percentage}
        durationDelta={metrics.duration.delta}
        durationPercentage={metrics.duration.percentage}
        spanDiff={spanDiff}
      />
      
      {/* Timeline Diff */}
      <TimelineDiff
        traceA={traceA}
        traceB={traceB}
        spanDiff={spanDiff}
      />
    </div>
  );
}
