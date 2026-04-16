import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppShell } from './app-shell';
import { ThemeModeProvider } from '@/components/theme/theme-mode-provider';

vi.mock('./sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock('./top-bar', () => ({
  TopBar: () => <div>TopBar</div>,
}));

vi.mock('./operator-command-palette', () => ({
  OperatorCommandPalette: () => <div>Quick jump</div>,
}));

vi.mock('./segment-persistence-bridge', () => ({
  SegmentPersistenceBridge: () => <div>Segment Persistence</div>,
}));

vi.mock('@/components/investigation/breadcrumb', () => ({
  InvestigationBreadcrumb: () => <div>Breadcrumb</div>,
}));

vi.mock('@/components/investigation/compact-mode', () => ({
  CompactModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CompactModeToggle: () => <button type="button">Comfortable</button>,
}));

describe('AppShell sandbox header', () => {
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

  it('renders the theme toggle in sandbox mode without a signed-in user', async () => {
    render(
      <ThemeModeProvider>
        <AppShell mode="sandbox">
          <div>Sandbox content</div>
        </AppShell>
      </ThemeModeProvider>,
    );

    const toggleButton = await screen.findByRole('button', { name: /switch to dark mode/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(window.localStorage.getItem('foxhound-theme-mode')).toBe('dark');
  });
});
