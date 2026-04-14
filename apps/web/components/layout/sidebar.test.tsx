import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './sidebar';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('Sidebar', () => {
  it('renders workflow section labels', () => {
    usePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Investigate')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Govern')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('keeps current routes reachable and includes prompts', () => {
    usePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Executive Summary/i })).toHaveAttribute('href', '/executive');
    expect(screen.getByRole('link', { name: /Traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Prompts/i })).toHaveAttribute('href', '/prompts');
    expect(screen.getByRole('link', { name: /Session Replay/i })).toHaveAttribute('href', '/replay');
    expect(screen.getByRole('link', { name: /Evaluators/i })).toHaveAttribute('href', '/evaluators');
    expect(screen.getByRole('link', { name: /Experiments/i })).toHaveAttribute('href', '/experiments');
    expect(screen.getByRole('link', { name: /Budgets/i })).toHaveAttribute('href', '/budgets');
    expect(screen.getByRole('link', { name: /Notifications/i })).toHaveAttribute('href', '/notifications');
  });

  it('marks the matching item active for nested routes', () => {
    usePathname.mockReturnValue('/prompts/pmt_123/diff');
    render(<Sidebar />);

    const promptsLink = screen.getByRole('link', { name: /Prompts/i });
    expect(promptsLink.className).toContain('bg-primary/12');
    expect(promptsLink.className).toContain('text-primary');
  });

  it('uses demo-prefixed links in demo mode', () => {
    usePathname.mockReturnValue('/demo/prompts');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: /Prompts/i })).toHaveAttribute('href', '/demo/prompts');
  });
});
