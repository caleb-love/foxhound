import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurateDatasetFromTracesDialog, TriggerEvaluatorRunsDialog } from './improve-create-actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('improve action dialogs', () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it('renders dataset trace-curation controls after opening', () => {
    render(
      <CurateDatasetFromTracesDialog
        datasets={[{ id: 'ds_1', name: 'support-routing-regressions' }]}
        curateDatasetAction={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Curate from traces/i }));

    expect(screen.getByLabelText(/Dataset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Score name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Threshold/i)).toBeInTheDocument();
  });

  it('renders evaluator run-trigger controls after opening', () => {
    render(
      <TriggerEvaluatorRunsDialog
        evaluators={[{ id: 'ev_1', name: 'helpfulness-judge' }]}
        triggerEvaluatorRunsAction={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Trigger runs/i }));

    expect(screen.getByLabelText(/Evaluator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Trace IDs/i)).toBeInTheDocument();
  });
});
