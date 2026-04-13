import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthError from './error';

describe('AuthError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders a safe authentication error message', () => {
    render(<AuthError error={new Error('secret backend detail')} reset={vi.fn()} />);

    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('We encountered an error during authentication.')).toBeInTheDocument();
    expect(screen.queryByText('secret backend detail')).not.toBeInTheDocument();
  });

  it('calls reset when try again is clicked', () => {
    const reset = vi.fn();
    render(<AuthError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('navigates home when return home is clicked', () => {
    render(<AuthError error={new Error('boom')} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Return home' }));
    expect(window.location.href).toBe('/');
  });
});
