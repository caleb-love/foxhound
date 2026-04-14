import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperatorCommandPalette } from './operator-command-palette';

const push = vi.fn();
const usePathname = vi.fn();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('scrollIntoView', vi.fn());
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => usePathname(),
}));

describe('OperatorCommandPalette', () => {
  it('opens from the quick jump trigger and navigates to a selected route', () => {
    usePathname.mockReturnValue('/');
    render(<OperatorCommandPalette />);

    fireEvent.click(screen.getByRole('button', { name: /open operator command palette/i }));

    expect(screen.getByText('Fleet Overview')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Regressions'));

    expect(push).toHaveBeenCalledWith('/regressions');
  });

  it('opens with keyboard shortcut and marks current route', () => {
    usePathname.mockReturnValue('/datasets');
    render(<OperatorCommandPalette />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });
});
