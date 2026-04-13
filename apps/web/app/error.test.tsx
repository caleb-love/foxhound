import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalError from './error';

describe('GlobalError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders a safe global error message', () => {
    render(<GlobalError error={new Error('sensitive server detail')} reset={vi.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Our team has been notified.')).toBeInTheDocument();
    expect(screen.queryByText('sensitive server detail')).not.toBeInTheDocument();
  });

  it('calls reset when try again is clicked', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('navigates home when go home is clicked', () => {
    render(<GlobalError error={new Error('boom')} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }));
    expect(window.location.href).toBe('/');
  });
});
