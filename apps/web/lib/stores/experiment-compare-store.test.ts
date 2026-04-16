import { beforeEach, describe, expect, it } from 'vitest';
import { useExperimentCompareStore } from './experiment-compare-store';

function installMockLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

describe('useExperimentCompareStore', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    useExperimentCompareStore.getState().clearPair();
  });

  it('stores and swaps an experiment comparison pair', () => {
    useExperimentCompareStore.getState().setPair('exp_a', 'exp_b');

    expect(useExperimentCompareStore.getState().baselineExperimentId).toBe('exp_a');
    expect(useExperimentCompareStore.getState().candidateExperimentId).toBe('exp_b');

    useExperimentCompareStore.getState().swapPair();

    expect(useExperimentCompareStore.getState().baselineExperimentId).toBe('exp_b');
    expect(useExperimentCompareStore.getState().candidateExperimentId).toBe('exp_a');
  });
});
