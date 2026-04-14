'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Layers3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { useFilterStore } from '@/lib/stores/filter-store';
import { upsertSegmentInUrl } from '@/lib/segment-url';

export function SegmentSwitcher() {
  const [draftName, setDraftName] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    currentSegmentName,
    savedSegments,
    saveCurrentSegment,
    applySavedSegment,
    deleteSavedSegment,
    resetCurrentSegment,
  } = useSegmentStore();
  const filterState = useFilterStore();

  const updateUrl = (segmentName: string | null) => {
    const query = searchParams?.toString() ?? '';
    const nextUrl = upsertSegmentInUrl(`${pathname}${query ? `?${query}` : ''}`, segmentName);
    router.replace(nextUrl);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" className="flex items-center gap-2 rounded-full border px-3 shadow-sm backdrop-blur" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
          <Layers3 className="h-4 w-4" />
          <span className="text-sm font-medium">Segment: {currentSegmentName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Segmentation</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            resetCurrentSegment();
            filterState.clearFilters();
            updateUrl(null);
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to all traffic
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Save current segment</div>
          <div className="flex gap-2">
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="e.g. Planner regressions"
            />
            <Button
              size="sm"
              onClick={() => {
                const name = draftName.trim();
                if (!name) return;
                saveCurrentSegment(name);
                updateUrl(name);
                setDraftName('');
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Saved segments</DropdownMenuLabel>
        {savedSegments.map((segment) => (
          <div key={segment.id} className="flex items-center gap-1 px-1 py-0.5">
            <DropdownMenuItem
              className="flex-1"
              onClick={() => {
                applySavedSegment(segment.id);
                filterState.clearFilters();
                const next = segment.filters;
                filterState.setStatus(next.status);
                filterState.setSeverity(next.severity);
                filterState.setAgentIds(next.agentIds);
                filterState.setStringArrayFilter('environments', next.environments);
                filterState.setStringArrayFilter('promptIds', next.promptIds);
                filterState.setStringArrayFilter('promptVersionIds', next.promptVersionIds);
                filterState.setStringArrayFilter('evaluatorIds', next.evaluatorIds);
                filterState.setStringArrayFilter('datasetIds', next.datasetIds);
                filterState.setStringArrayFilter('models', next.models);
                filterState.setStringArrayFilter('toolNames', next.toolNames);
                filterState.setStringArrayFilter('tags', next.tags);
                filterState.setSearchQuery(next.searchQuery);
                filterState.setDateRange(next.dateRange.start, next.dateRange.end);
                updateUrl(segment.name);
              }}
            >
              {segment.name}
            </DropdownMenuItem>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteSavedSegment(segment.id)}
              aria-label={`Delete ${segment.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
