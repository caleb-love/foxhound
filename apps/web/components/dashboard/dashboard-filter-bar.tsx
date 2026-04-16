'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Filter, Search, X } from 'lucide-react';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import {
  createDateRangeFromHours,
  createDateRangeFromPreset,
  getMatchingDatePresetLabel,
} from '@/lib/stores/dashboard-filter-presets';

function countActiveFilters(definitions: DashboardFilterDefinition[], state: ReturnType<typeof useSegmentStore.getState>['currentFilters']) {
  return definitions.reduce((count, definition) => {
    if (definition.key === 'searchQuery') return count + (state.searchQuery ? 1 : 0);
    if (definition.key === 'status') return count + (state.status !== 'all' ? 1 : 0);
    if (definition.key === 'severity') return count + (state.severity !== 'all' ? 1 : 0);
    if (definition.key === 'dateRange') {
      const defaultRange = createDateRangeFromHours(24);
      const isDefaultRange =
        Math.abs(state.dateRange.start.getTime() - defaultRange.start.getTime()) <= 5 * 60 * 1000 &&
        Math.abs(state.dateRange.end.getTime() - defaultRange.end.getTime()) <= 5 * 60 * 1000;
      return count + (isDefaultRange ? 0 : 1);
    }
    const values = state[definition.key];
    return count + (Array.isArray(values) && values.length > 0 ? 1 : 0);
  }, 0);
}

export function DashboardFilterBar({ definitions }: { definitions: DashboardFilterDefinition[] }) {
  const store = useSegmentStore((state) => state.currentFilters);
  const updateCurrentFilters = useSegmentStore((state) => state.updateCurrentFilters);
  const setCurrentSegmentName = useSegmentStore((state) => state.setCurrentSegmentName);
  useFilterStore();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const activeCount = countActiveFilters(definitions, store);
  const datePresetDefinition = definitions.find(
    (definition): definition is Extract<DashboardFilterDefinition, { kind: 'date-preset' }> => definition.kind === 'date-preset',
  );
  const activeDatePresetLabel = datePresetDefinition
    ? getMatchingDatePresetLabel(store.dateRange, datePresetDefinition.presets)
    : null;

  const applyPartial = (partial: Partial<typeof store>) => {
    updateCurrentFilters(partial);
    useFilterStore.setState((state) => ({ ...state, ...partial }));
    setCurrentSegmentName('Custom segment');
  };

  return (
    <div className="space-y-4 rounded-3xl border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
      <div className="flex flex-wrap items-center gap-3">
        {definitions.map((definition) => {
          if (definition.kind === 'search') {
            return (
              <div key={definition.key} className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tenant-text-muted" />
                <Input
                  placeholder={definition.placeholder ?? 'Search...'}
                  value={store.searchQuery}
                  onChange={(e) => applyPartial({ searchQuery: e.target.value })}
                  className="pl-10 pr-10"
                />
                {store.searchQuery ? (
                  <button
                    onClick={() => applyPartial({ searchQuery: '' })}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--tenant-text-muted)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          }

          if (definition.kind === 'single-select') {
            const value = store[definition.key];
            const selectValue = typeof value === 'string' ? value : 'all';
            const setValue = (next: string) => applyPartial({ [definition.key]: next } as Partial<typeof store>);

            return (
              <div key={definition.key} className="flex items-center gap-2">
                <span className="text-sm font-medium text-tenant-text-secondary">{definition.label}:</span>
                <Select value={selectValue} onValueChange={(next) => setValue(next as never)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={definition.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {definition.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (definition.kind === 'date-preset') {
            const selectedPresetLabel = getMatchingDatePresetLabel(store.dateRange, definition.presets);
            const selectedValue = selectedPresetLabel ?? 'custom';

            return (
              <Select
                key={definition.key}
                value={selectedValue}
                onValueChange={(value) => {
                  if (value === 'custom') return;
                  const preset = definition.presets.find((item) => item.label === value);
                  if (!preset) return;
                  const next = createDateRangeFromPreset(preset);
                  applyPartial({ dateRange: { start: next.start, end: next.end } });
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={definition.label} />
                </SelectTrigger>
                <SelectContent>
                  {definition.presets.map((preset) => (
                    <SelectItem key={preset.label} value={preset.label}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  {selectedPresetLabel ? null : <SelectItem value="custom">Custom range</SelectItem>}
                </SelectContent>
              </Select>
            );
          }

          const selected = store[definition.key];
          const selectedValues = Array.isArray(selected) ? selected : [];

          return (
            <Popover key={definition.key} open={openKey === definition.key} onOpenChange={(open) => setOpenKey(open ? definition.key : null)}>
              <PopoverTrigger className="group/button inline-flex h-7 items-center justify-center gap-2 rounded-[min(var(--radius-md),12px)] border px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
                <Filter className="h-4 w-4" />
                {definition.label}
                {selectedValues.length > 0 ? (
                  <Badge variant="secondary" className="ml-1 rounded-full px-1.5">{selectedValues.length}</Badge>
                ) : null}
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Filter by {definition.label}</h4>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {definition.options.map((option) => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = isSelected
                                ? selectedValues.filter((value) => value !== option.value)
                                : [...selectedValues, option.value];
                              applyPartial({ [definition.key]: next } as Partial<typeof store>);
                            }}
                            className="rounded"
                            style={{ borderColor: 'var(--tenant-panel-stroke)' }}
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedValues.length > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => applyPartial({ [definition.key]: [] } as Partial<typeof store>)} className="w-full">
                      Clear selection
                    </Button>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}

        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => {
            const defaults = createDateRangeFromHours(24);
            const reset = {
              status: 'all',
              severity: 'all',
              agentIds: [],
              environments: [],
              promptIds: [],
              promptVersionIds: [],
              evaluatorIds: [],
              datasetIds: [],
              models: [],
              toolNames: [],
              tags: [],
              searchQuery: '',
              dateRange: { start: defaults.start, end: defaults.end },
            } as Partial<typeof store>;
            applyPartial(reset);
            setCurrentSegmentName('All traffic');
          }} className="gap-2 text-tenant-text-secondary">
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {activeCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-tenant-text-secondary">
          <span>Active filters:</span>
          {store.status !== 'all' ? <Badge variant="secondary">Status: {store.status}</Badge> : null}
          {store.severity !== 'all' ? <Badge variant="secondary">Severity: {store.severity}</Badge> : null}
          {store.agentIds.length > 0 ? <Badge variant="secondary">{store.agentIds.length} agents</Badge> : null}
          {store.environments.length > 0 ? <Badge variant="secondary">{store.environments.length} environments</Badge> : null}
          {store.models.length > 0 ? <Badge variant="secondary">{store.models.length} models</Badge> : null}
          {store.searchQuery ? <Badge variant="secondary">Search: &quot;{store.searchQuery}&quot;</Badge> : null}
          {activeDatePresetLabel ? <Badge variant="secondary">Date: {activeDatePresetLabel}</Badge> : null}
        </div>
      ) : null}
    </div>
  );
}
