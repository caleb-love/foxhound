import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '../filter-store';

describe('useFilterStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useFilterStore.getState().clearFilters();
  });

  it('should have default values', () => {
    const state = useFilterStore.getState();
    
    expect(state.status).toBe('all');
    expect(state.agentIds).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.dateRange.start).toBeInstanceOf(Date);
    expect(state.dateRange.end).toBeInstanceOf(Date);
  });

  it('should set status filter', () => {
    const { setStatus } = useFilterStore.getState();
    
    setStatus('error');
    
    expect(useFilterStore.getState().status).toBe('error');
  });

  it('should set agent IDs filter', () => {
    const { setAgentIds } = useFilterStore.getState();
    const agents = ['agent-1', 'agent-2'];
    
    setAgentIds(agents);
    
    expect(useFilterStore.getState().agentIds).toEqual(agents);
  });

  it('should set search query', () => {
    const { setSearchQuery } = useFilterStore.getState();
    const query = 'test query';
    
    setSearchQuery(query);
    
    expect(useFilterStore.getState().searchQuery).toBe(query);
  });

  it('should set date range', () => {
    const { setDateRange } = useFilterStore.getState();
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    
    setDateRange(start, end);
    
    const state = useFilterStore.getState();
    expect(state.dateRange.start).toEqual(start);
    expect(state.dateRange.end).toEqual(end);
  });

  it('should clear all filters', () => {
    const store = useFilterStore.getState();
    
    // Set some filters
    store.setStatus('error');
    store.setAgentIds(['agent-1']);
    store.setSearchQuery('test');
    
    // Clear filters
    store.clearFilters();
    
    // Verify all filters reset
    const state = useFilterStore.getState();
    expect(state.status).toBe('all');
    expect(state.agentIds).toEqual([]);
    expect(state.searchQuery).toBe('');
  });
});
