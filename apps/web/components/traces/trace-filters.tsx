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
import { cn } from '@/lib/utils';

interface TraceFiltersProps {
  availableAgents: string[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-800' },
  { value: 'success', label: 'Success', color: 'bg-green-100 text-green-800' },
  { value: 'error', label: 'Error', color: 'bg-red-100 text-red-800' },
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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search traces by ID, agent, or workflow..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatus(option.value)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                status === option.value
                  ? option.color
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Agent Filter */}
        <Popover open={isAgentPopoverOpen} onOpenChange={setIsAgentPopoverOpen}>
          <PopoverTrigger>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Agents
              {agentIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
                  {agentIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter by Agent</h4>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {availableAgents.map((agentId) => (
                  <label
                    key={agentId}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={agentIds.includes(agentId)}
                      onChange={() => toggleAgent(agentId)}
                      className="rounded border-gray-300"
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
            <div className="h-6 w-px bg-gray-200" />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2 text-gray-600"
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          </>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
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
