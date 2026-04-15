import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeModeProvider, useThemeMode } from './theme-mode-provider';

function ThemeHarness() {
  const { mode, resolvedMode, toggleMode, setMode } = useThemeMode();

  return (
    <div>
      <div>Mode: {mode}</div>
      <div>Resolved: {resolvedMode}</div>
      <button type="button" onClick={toggleMode}>Toggle</button>
      <button type="button" onClick={() => setMode('light')}>Light</button>
      <button type="button" onClick={() => setMode('dark')}>Dark</button>
    </div>
  );
}

describe('ThemeModeProvider', () => {
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
    document.documentElement.style.colorScheme = 'light';
    delete document.documentElement.dataset.themeMode;
  });

  it('defaults to light mode when no saved preference exists', async () => {
    render(
      <ThemeModeProvider>
        <ThemeHarness />
      </ThemeModeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Mode: light')).toBeInTheDocument();
    });
    expect(screen.getByText('Resolved: light')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.themeMode).toBe('light');
  });

  it('restores saved dark mode and persists subsequent toggles', async () => {
    window.localStorage.setItem('foxhound-theme-mode', 'dark');

    render(
      <ThemeModeProvider>
        <ThemeHarness />
      </ThemeModeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Mode: dark')).toBeInTheDocument();
    });
    expect(screen.getByText('Resolved: dark')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(screen.getByText('Mode: light')).toBeInTheDocument();
    });
    expect(screen.getByText('Resolved: light')).toBeInTheDocument();
    expect(window.localStorage.getItem('foxhound-theme-mode')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
