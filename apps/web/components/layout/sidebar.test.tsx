import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from './sidebar';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const usePathname = vi.fn();

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('Sidebar', () => {
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

    useSearchParams.mockReturnValue(new URLSearchParams(''));
    useSegmentStore.setState({
      currentSegmentName: 'Planner agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders workflow section labels', () => {
    usePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Investigate')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Govern')).toBeInTheDocument();

  });

  it('keeps current routes reachable and includes prompts', () => {
    usePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Executive Summary/i })).toHaveAttribute('href', '/executive?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Traces/i })).toHaveAttribute('href', '/traces?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Prompts/i })).toHaveAttribute('href', '/prompts?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Session Replay/i })).toHaveAttribute('href', '/replay?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Evaluators/i })).toHaveAttribute('href', '/evaluators?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Experiments/i })).toHaveAttribute('href', '/experiments?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Budgets/i })).toHaveAttribute('href', '/budgets?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Notifications/i })).toHaveAttribute('href', '/notifications?segment=Planner+agent');
  });

  it('marks the matching item active for nested routes', () => {
    usePathname.mockReturnValue('/prompts/pmt_123/diff');
    render(<Sidebar />);

    const promptsLink = screen.getByRole('link', { name: /Prompts/i });
    expect(promptsLink.getAttribute('href')).toBe('/prompts?segment=Planner+agent');
    expect(promptsLink.className).toContain('rounded-xl');
  });

  it('uses sandbox-prefixed links in sandbox mode', () => {
    usePathname.mockReturnValue('/sandbox/prompts');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/sandbox?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Prompts/i })).toHaveAttribute('href', '/sandbox/prompts?segment=Planner+agent');
  });

  it('uses a seeded sandbox diff link instead of a bare diff route', () => {
    usePathname.mockReturnValue('/sandbox/prompts');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Run Diff/i })).toHaveAttribute(
      'href',
      '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression&segment=Planner+agent',
    );
  });

  it('treats legacy demo paths as non-sandbox paths after retirement', () => {
    usePathname.mockReturnValue('/demo/prompts');
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Prompts/i })).toHaveAttribute('href', '/prompts?segment=Planner+agent');
  });

  it('collapses to icon-only navigation and still keeps links usable', () => {
    usePathname.mockReturnValue('/traces');
    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: /Collapse sidebar/i }));

    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fleet Overview/i })).toHaveAttribute('href', '/?segment=Planner+agent');
    expect(screen.getByRole('link', { name: /Traces/i })).toHaveAttribute('href', '/traces?segment=Planner+agent');
    expect(window.localStorage.getItem('foxhound.sidebar.collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: /Expand sidebar/i })).toBeInTheDocument();
  });
});
