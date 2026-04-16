import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompareExperimentsDialog } from './experiment-compare-actions';
import { useExperimentCompareStore } from '@/lib/stores/experiment-compare-store';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

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

const experiments = [
  { id: 'exp_1', name: 'returns-recovery-v19', status: 'completed' },
  { id: 'exp_2', name: 'shipping-fallback-hardening', status: 'completed' },
  { id: 'exp_3', name: 'premium-escalation-tuning', status: 'running' },
];

describe('CompareExperimentsDialog', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    push.mockReset();
    useExperimentCompareStore.getState().clearPair();
  });

  it('opens comparison for two selected completed experiments', async () => {
    render(<CompareExperimentsDialog experiments={experiments} />);

    fireEvent.click(screen.getByRole('button', { name: /Compare experiments/i }));
    fireEvent.change(screen.getByLabelText('Baseline experiment'), { target: { value: 'exp_1' } });
    fireEvent.change(screen.getByLabelText('Candidate experiment'), { target: { value: 'exp_2' } });
    fireEvent.click(screen.getByRole('button', { name: /Open comparison/i }));

    expect(push).toHaveBeenCalledWith('/experiments/compare?experimentIds=exp_1%2Cexp_2');
    expect(useExperimentCompareStore.getState().baselineExperimentId).toBe('exp_1');
    expect(useExperimentCompareStore.getState().candidateExperimentId).toBe('exp_2');
  });

  it('rewrites the route for sandbox baseHref', async () => {
    render(<CompareExperimentsDialog experiments={experiments} baseHref="/sandbox" />);

    fireEvent.click(screen.getByRole('button', { name: /Compare experiments/i }));
    fireEvent.change(screen.getByLabelText('Baseline experiment'), { target: { value: 'exp_2' } });
    fireEvent.change(screen.getByLabelText('Candidate experiment'), { target: { value: 'exp_1' } });
    fireEvent.click(screen.getByRole('button', { name: /Open comparison/i }));

    expect(push).toHaveBeenCalledWith('/sandbox/experiments/compare?experimentIds=exp_2%2Cexp_1');
  });

  it('prefills from the persisted comparison pair', async () => {
    useExperimentCompareStore.getState().setPair('exp_2', 'exp_1');

    render(<CompareExperimentsDialog experiments={experiments} />);

    fireEvent.click(screen.getByRole('button', { name: /Compare experiments/i }));

    expect(screen.getByLabelText('Baseline experiment')).toHaveValue('exp_2');
    expect(screen.getByLabelText('Candidate experiment')).toHaveValue('exp_1');
  });

  it('blocks comparing the same experiment against itself', async () => {
    render(<CompareExperimentsDialog experiments={experiments} />);

    fireEvent.click(screen.getByRole('button', { name: /Compare experiments/i }));
    fireEvent.change(screen.getByLabelText('Baseline experiment'), { target: { value: 'exp_1' } });
    fireEvent.change(screen.getByLabelText('Candidate experiment'), { target: { value: 'exp_1' } });
    fireEvent.click(screen.getByRole('button', { name: /Open comparison/i }));

    expect(screen.getByText(/Choose two different experiments/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
