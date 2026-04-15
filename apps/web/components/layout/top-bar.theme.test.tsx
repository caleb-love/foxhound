import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TopBar } from './top-bar';
import { ThemeModeProvider } from '@/components/theme/theme-mode-provider';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

vi.mock('./operator-command-palette', () => ({
  OperatorCommandPalette: () => <div>Command Palette</div>,
}));

vi.mock('./segment-switcher', () => ({
  SegmentSwitcher: () => <div>Segment Switcher</div>,
}));

describe('TopBar theme toggle', () => {
  beforeEach(() => {
    const localStorageState = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageState.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStorageState.set(key, value);
        },
        removeItem: (key: string) => {
          localStorageState.delete(key);
        },
        clear: () => {
          localStorageState.clear();
        },
      },
      configurable: true,
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark') ? false : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.themeMode;
  });

  it('toggles into dark mode from the top bar button', async () => {
    render(
      <ThemeModeProvider>
        <TopBar user={{ name: 'Caleb', email: 'caleb@example.com' }} />
      </ThemeModeProvider>,
    );

    const toggleButton = await screen.findByRole('button', { name: /switch to dark mode/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(window.localStorage.getItem('foxhound-theme-mode')).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });
});
