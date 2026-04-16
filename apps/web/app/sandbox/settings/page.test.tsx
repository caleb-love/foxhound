import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SandboxSettingsPage from './page';
import { ThemeModeProvider } from '@/components/theme/theme-mode-provider';
import { TenantThemeProvider } from '@/components/theme/tenant-theme-provider';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/sandbox/settings',
  useSearchParams: () => new URLSearchParams(),
}));

describe('SandboxSettingsPage', () => {
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

  it('renders appearance controls and switches to dark mode', async () => {
    render(
      <ThemeModeProvider>
        <TenantThemeProvider>
          <SandboxSettingsPage />
        </TenantThemeProvider>
      </ThemeModeProvider>,
    );

    expect(screen.getByText('Appearance mode')).toBeInTheDocument();
    const darkButtons = screen.getAllByRole('button', { name: /dark/i });
    expect(darkButtons.length).toBeGreaterThan(0);
    expect(screen.getByText(/Appearance mode: light/i)).toBeInTheDocument();

    fireEvent.click(darkButtons[0]!);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(window.localStorage.getItem('foxhound-theme-mode')).toBe('dark');
  });
});
