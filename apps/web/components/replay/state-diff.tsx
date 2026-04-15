'use client';

import type { Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Plus, Minus, Equal } from 'lucide-react';
import { tenantStyles } from '@/components/sandbox/primitives';

interface StateDiffProps {
  previousSpan: Span | null;
  currentSpan: Span;
}

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

interface AttributeDiff {
  key: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
}

export function StateDiff({ previousSpan, currentSpan }: StateDiffProps) {
  if (!previousSpan) {
    return (
      <div className="rounded-lg p-4" style={tenantStyles.panelAlt}>
        <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
          First step - no previous state to compare
        </p>
      </div>
    );
  }

  const diffs = computeAttributeDiffs(
    previousSpan.attributes,
    currentSpan.attributes
  );

  if (diffs.length === 0) {
    return (
      <div className="rounded-lg p-4" style={tenantStyles.panelAlt}>
        <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
          No attribute changes from previous step
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>
        State Changes from Previous Step
      </h3>
      <div className="divide-y overflow-hidden rounded-lg" style={tenantStyles.panel}>
        {diffs.map((diff, i) => (
          <DiffRow key={i} diff={diff} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ diff }: { diff: AttributeDiff }) {
  const icons = {
    added: <Plus className="h-4 w-4" style={{ color: 'var(--tenant-success)' }} />,
    removed: <Minus className="h-4 w-4" style={{ color: 'var(--tenant-danger)' }} />,
    changed: <ArrowRight className="h-4 w-4" style={{ color: 'var(--tenant-accent)' }} />,
    unchanged: <Equal className="h-4 w-4" style={{ color: 'var(--tenant-text-muted)' }} />,
  };

  const badges = {
    added: <Badge style={{ background: 'color-mix(in srgb, var(--tenant-success) 14%, white)', color: 'var(--tenant-success)' }}>Added</Badge>,
    removed: <Badge style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, white)', color: 'var(--tenant-danger)' }}>Removed</Badge>,
    changed: <Badge style={{ background: 'color-mix(in srgb, var(--tenant-accent) 14%, white)', color: 'var(--tenant-accent)' }}>Changed</Badge>,
    unchanged: <Badge variant="secondary">Unchanged</Badge>,
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5">{icons[diff.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
            {diff.key}
          </span>
          {badges[diff.type]}
        </div>
        {diff.type === 'changed' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded px-2 py-1 font-mono line-through" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 10%, white)', color: 'var(--tenant-danger)' }}>
              {formatValue(diff.oldValue)}
            </span>
            <ArrowRight className="h-3 w-3" style={{ color: 'var(--tenant-text-muted)' }} />
            <span className="rounded px-2 py-1 font-mono" style={{ background: 'color-mix(in srgb, var(--tenant-success) 10%, white)', color: 'var(--tenant-success)' }}>
              {formatValue(diff.newValue)}
            </span>
          </div>
        )}
        {diff.type === 'added' && (
          <span className="text-xs font-mono" style={{ color: 'var(--tenant-success)' }}>
            {formatValue(diff.newValue)}
          </span>
        )}
        {diff.type === 'removed' && (
          <span className="text-xs font-mono line-through" style={{ color: 'var(--tenant-danger)' }}>
            {formatValue(diff.oldValue)}
          </span>
        )}
      </div>
    </div>
  );
}

function computeAttributeDiffs(
  oldAttrs: Record<string, unknown>,
  newAttrs: Record<string, unknown>
): AttributeDiff[] {
  const diffs: AttributeDiff[] = [];
  const allKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]);

  allKeys.forEach((key) => {
    const oldValue = oldAttrs[key];
    const newValue = newAttrs[key];

    if (oldValue === undefined && newValue !== undefined) {
      diffs.push({ key, type: 'added', newValue });
    } else if (oldValue !== undefined && newValue === undefined) {
      diffs.push({ key, type: 'removed', oldValue });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({ key, type: 'changed', oldValue, newValue });
    }
    // Skip unchanged attributes for cleaner view
  });

  return diffs;
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
