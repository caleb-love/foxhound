import { describe, it, expect, beforeEach } from 'vitest';
import { useCompareStore } from '../compare-store';

describe('useCompareStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useCompareStore.getState().clearSelection();
  });

  it('should start with empty selection', () => {
    const state = useCompareStore.getState();
    
    expect(state.selectedTraceIds).toEqual([]);
    expect(state.canCompare()).toBe(false);
  });

  it('should toggle trace selection', () => {
    const { toggleTrace } = useCompareStore.getState();
    const traceId = 'trace-1';
    
    toggleTrace(traceId);
    
    expect(useCompareStore.getState().selectedTraceIds).toEqual([traceId]);
  });

  it('should deselect trace when toggled again', () => {
    const { toggleTrace } = useCompareStore.getState();
    const traceId = 'trace-1';
    
    toggleTrace(traceId);
    toggleTrace(traceId);
    
    expect(useCompareStore.getState().selectedTraceIds).toEqual([]);
  });

  it('should allow selecting two traces', () => {
    const { toggleTrace } = useCompareStore.getState();
    
    toggleTrace('trace-1');
    toggleTrace('trace-2');
    
    const state = useCompareStore.getState();
    expect(state.selectedTraceIds).toEqual(['trace-1', 'trace-2']);
    expect(state.canCompare()).toBe(true);
  });

  it('should replace oldest trace when selecting third', () => {
    const { toggleTrace } = useCompareStore.getState();
    
    toggleTrace('trace-1');
    toggleTrace('trace-2');
    toggleTrace('trace-3');
    
    const state = useCompareStore.getState();
    // Should keep trace-2 and trace-3, removing trace-1
    expect(state.selectedTraceIds).toEqual(['trace-2', 'trace-3']);
    expect(state.canCompare()).toBe(true);
  });

  it('should clear all selections', () => {
    const store = useCompareStore.getState();
    
    store.toggleTrace('trace-1');
    store.toggleTrace('trace-2');
    store.clearSelection();
    
    expect(useCompareStore.getState().selectedTraceIds).toEqual([]);
  });

  it('should only allow compare with exactly 2 traces', () => {
    const store = useCompareStore.getState();
    
    expect(store.canCompare()).toBe(false);
    
    store.toggleTrace('trace-1');
    expect(store.canCompare()).toBe(false);
    
    store.toggleTrace('trace-2');
    expect(store.canCompare()).toBe(true);
    
    store.clearSelection();
    expect(store.canCompare()).toBe(false);
  });
});
