import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardError from './error';

describe('DashboardError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders a safe dashboard error message', () => {
    render(<DashboardError error={new Error('internal stack detail')} reset={vi.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We encountered an error while loading this page.')).toBeInTheDocument();
    expect(screen.queryByText('internal stack detail')).not.toBeInTheDocument();
  });

  it('calls reset when try again is clicked', () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('navigates to dashboard root when return button is clicked', () => {
    render(<DashboardError error={new Error('boom')} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));
    expect(window.location.href).toBe('/');
  });
});
