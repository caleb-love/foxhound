import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigureBudgetDialog, ConfigureSlaDialog, TestNotificationDialog } from './govern-create-actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('govern action dialogs', () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it('renders budget configuration controls after opening', () => {
    render(<ConfigureBudgetDialog configureBudgetAction={vi.fn().mockResolvedValue({ ok: true })} />);

    fireEvent.click(screen.getByRole('button', { name: /Configure budget/i }));

    expect(screen.getByLabelText(/Agent id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Budget USD/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Budget period/i)).toBeInTheDocument();
  });

  it('renders SLA configuration controls after opening', () => {
    render(<ConfigureSlaDialog configureSlaAction={vi.fn().mockResolvedValue({ ok: true })} />);

    fireEvent.click(screen.getByRole('button', { name: /Configure SLA/i }));

    expect(screen.getByLabelText(/Agent id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max duration ms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Min success rate/i)).toBeInTheDocument();
  });

  it('renders notification test controls after opening', () => {
    render(
      <TestNotificationDialog
        channels={[{ id: 'ch_1', name: 'ops-slack' }]}
        testNotificationAction={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Send test/i }));

    expect(screen.getByLabelText(/Channel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Event type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();
  });
});
