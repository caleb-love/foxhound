import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SandboxSettingsPage from './page';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/sandbox/settings',
  useSearchParams: () => new URLSearchParams(),
}));

describe('SandboxSettingsPage', () => {
  it('renders the simplified settings page', () => {
    render(<SandboxSettingsPage />);

    expect(screen.getByText('Workspace settings')).toBeInTheDocument();
    expect(screen.getByText(/light\/dark toggle/i)).toBeInTheDocument();
  });
});
