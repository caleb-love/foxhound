'use client';

import { useState } from 'react';
import { useFilterStore, type StatusFilter } from '@/lib/stores/filter-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Search, X, Calendar, Filter } from 'lucide-react';

interface TraceFiltersProps {
  availableAgents: string[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'color-mix(in srgb, var(--card) 88%, var(--background))' },
  { value: 'success', label: 'Success', color: 'color-mix(in srgb, var(--tenant-success) 18%, var(--card))' },
  { value: 'error', label: 'Error', color: 'color-mix(in srgb, var(--tenant-danger) 18%, var(--card))' },
];

const DATE_PRESETS = [
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 7d', hours: 24 * 7 },
  { label: 'Last 30d', hours: 24 * 30 },
];

export function TraceFilters({ availableAgents }: TraceFiltersProps) {
  const {
    status,
    agentIds,
    searchQuery,
    setStatus,
    setAgentIds,
    setDateRange,
    setSearchQuery,
    clearFilters,
  } = useFilterStore();

  const [isAgentPopoverOpen, setIsAgentPopoverOpen] = useState(false);

  const handleDatePreset = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    setDateRange(start, end);
  };

  const toggleAgent = (agentId: string) => {
    if (agentIds.includes(agentId)) {
      setAgentIds(agentIds.filter((id) => id !== agentId));
    } else {
      setAgentIds([...agentIds, agentId]);
    }
  };

  const hasActiveFilters =
    status !== 'all' || agentIds.length > 0 || searchQuery !== '';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--tenant-text-muted)' }} />
        <Input
          placeholder="Search traces by ID, agent, or workflow..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--tenant-text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>Status:</span>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatus(option.value)}
              className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              style={status === option.value ? { background: option.color, color: option.value === 'success' ? 'var(--tenant-success)' : option.value === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-text-primary)', border: '1px solid var(--tenant-panel-stroke)' } : { background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)', border: '1px solid var(--tenant-panel-stroke)' }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px" style={{ background: 'var(--tenant-panel-stroke)' }} />

        {/* Agent Filter */}
        <Popover open={isAgentPopoverOpen} onOpenChange={setIsAgentPopoverOpen}>
          <PopoverTrigger
            className="inline-flex h-7 items-center gap-2 rounded-[min(var(--radius-md),12px)] border px-2.5 text-[0.8rem] font-medium transition-all outline-none"
            style={{
              borderColor: 'var(--tenant-panel-stroke)',
              background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
              color: 'var(--tenant-text-primary)',
            }}
          >
            <Filter className="h-4 w-4" />
            Agents
            {agentIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
                {agentIds.length}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter by Agent</h4>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {availableAgents.map((agentId) => (
                  <label
                    key={agentId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                    style={{ background: 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={agentIds.includes(agentId)}
                      onChange={() => toggleAgent(agentId)}
                      className="rounded"
                      style={{ borderColor: 'var(--tenant-panel-stroke)' }}
                    />
                    <span className="text-sm font-mono">{agentId}</span>
                  </label>
                ))}
              </div>
              {agentIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgentIds([])}
                  className="w-full"
                >
                  Clear selection
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range Presets */}
        <Select
          defaultValue="24"
          onValueChange={(value) => value && handleDatePreset(parseInt(value))}
        >
          <SelectTrigger className="w-32">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset.hours.toString()} value={preset.hours.toString()}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <>
            <div className="h-6 w-px" style={{ background: 'var(--tenant-panel-stroke)' }} />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
              style={{ color: 'var(--tenant-text-secondary)' }}
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          </>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
          <span>Active filters:</span>
          {status !== 'all' && (
            <Badge variant="secondary">Status: {status}</Badge>
          )}
          {agentIds.length > 0 && (
            <Badge variant="secondary">
              {agentIds.length} agent{agentIds.length > 1 ? 's' : ''}
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary">Search: &quot;{searchQuery}&quot;</Badge>
          )}
        </div>
      )}
    </div>
  );
}
