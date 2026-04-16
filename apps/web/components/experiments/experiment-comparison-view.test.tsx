import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExperimentComparisonView } from './experiment-comparison-view';
import { useExperimentCompareStore } from '@/lib/stores/experiment-compare-store';

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

const comparison = {
  experiments: [
    {
      id: 'exp_1',
      orgId: 'org_1',
      datasetId: 'ds_1',
      name: 'returns-recovery-v19',
      config: {},
      status: 'completed',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'exp_2',
      orgId: 'org_1',
      datasetId: 'ds_2',
      name: 'shipping-fallback-hardening',
      config: {},
      status: 'completed',
      createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    },
  ],
  runs: [
    {
      id: 'run_1',
      experimentId: 'exp_1',
      datasetItemId: 'item_1',
      latencyMs: 800,
      tokenCount: 300,
      cost: 0.01,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'run_2',
      experimentId: 'exp_2',
      datasetItemId: 'item_2',
      latencyMs: 650,
      tokenCount: 250,
      cost: 0.008,
      createdAt: new Date().toISOString(),
    },
  ],
  items: [
    {
      id: 'item_1',
      datasetId: 'ds_1',
      input: { traceId: 'trace_1' },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'item_2',
      datasetId: 'ds_2',
      input: { traceId: 'trace_2' },
      createdAt: new Date().toISOString(),
    },
  ],
  scores: [
    {
      id: 'score_1',
      orgId: 'org_1',
      traceId: 'trace_1',
      name: 'quality',
      value: 0.91,
      source: 'llm_judge',
      comment: 'run_1',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'score_2',
      orgId: 'org_1',
      traceId: 'trace_2',
      name: 'quality',
      value: 0.87,
      source: 'llm_judge',
      comment: 'run_2',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'score_3',
      orgId: 'org_1',
      traceId: 'trace_2',
      name: 'verdict',
      label: 'promotion-ready',
      source: 'llm_judge',
      comment: 'run_2',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('ExperimentComparisonView', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    useExperimentCompareStore.getState().clearPair();
  });

  it('renders comparison verdict and aggregate metrics', () => {
    render(<ExperimentComparisonView comparison={comparison as never} />);

    expect(screen.getByText(/completed experiments ready for side-by-side review/i)).toBeInTheDocument();
    expect(screen.getByText('Head-to-head metrics')).toBeInTheDocument();
    expect(screen.getByText('Comparison matrix')).toBeInTheDocument();
    expect(screen.getAllByText('returns-recovery-v19').length).toBeGreaterThan(0);
    expect(screen.getAllByText('shipping-fallback-hardening').length).toBeGreaterThan(0);
  });

  it('links back into experiment detail routes', () => {
    render(<ExperimentComparisonView comparison={comparison as never} baseHref="/sandbox" />);

    expect(screen.getAllByRole('link', { name: /Open experiment detail/i })[0]).toHaveAttribute('href', '/sandbox/experiments/exp_1');
    expect(screen.getAllByRole('link', { name: /Open experiment detail/i })[1]).toHaveAttribute('href', '/sandbox/experiments/exp_2');
    expect(screen.getByRole('link', { name: /Prompt review/i })).toHaveAttribute('href', '/sandbox/prompts');
  });

  it('exposes a swap action that updates the persisted pair', () => {
    useExperimentCompareStore.getState().setPair('exp_1', 'exp_2');

    render(<ExperimentComparisonView comparison={comparison as never} />);

    const swapButton = screen.getByRole('button', { name: /Swap pair/i });

    fireEvent.click(swapButton);

    expect(useExperimentCompareStore.getState().baselineExperimentId).toBe('exp_2');
    expect(useExperimentCompareStore.getState().candidateExperimentId).toBe('exp_1');
  });
});
