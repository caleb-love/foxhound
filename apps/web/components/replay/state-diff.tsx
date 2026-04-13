'use client';

import type { Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Plus, Minus, Equal } from 'lucide-react';

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
      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-500">
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
      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-500">
          No attribute changes from previous step
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">
        State Changes from Previous Step
      </h3>
      <div className="divide-y overflow-hidden rounded-lg border bg-white">
        {diffs.map((diff, i) => (
          <DiffRow key={i} diff={diff} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ diff }: { diff: AttributeDiff }) {
  const icons = {
    added: <Plus className="h-4 w-4 text-green-600" />,
    removed: <Minus className="h-4 w-4 text-red-600" />,
    changed: <ArrowRight className="h-4 w-4 text-blue-600" />,
    unchanged: <Equal className="h-4 w-4 text-gray-400" />,
  };

  const badges = {
    added: <Badge className="bg-green-100 text-green-800">Added</Badge>,
    removed: <Badge className="bg-red-100 text-red-800">Removed</Badge>,
    changed: <Badge className="bg-blue-100 text-blue-800">Changed</Badge>,
    unchanged: <Badge variant="secondary">Unchanged</Badge>,
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5">{icons[diff.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-medium text-gray-900">
            {diff.key}
          </span>
          {badges[diff.type]}
        </div>
        {diff.type === 'changed' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-red-50 px-2 py-1 font-mono text-red-700 line-through">
              {formatValue(diff.oldValue)}
            </span>
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <span className="rounded bg-green-50 px-2 py-1 font-mono text-green-700">
              {formatValue(diff.newValue)}
            </span>
          </div>
        )}
        {diff.type === 'added' && (
          <span className="text-xs font-mono text-green-700">
            {formatValue(diff.newValue)}
          </span>
        )}
        {diff.type === 'removed' && (
          <span className="text-xs font-mono text-red-700 line-through">
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
