import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const getServerSession = vi.fn();
const redirect = vi.fn();
const listPrompts = vi.fn();
const createPrompt = vi.fn();
const getAuthenticatedClient = vi.fn();
const refresh = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession,
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/api-client', () => ({
  getAuthenticatedClient,
}));

describe('dashboard prompts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
    getServerSession.mockResolvedValue({
      user: {
        token: 'token',
      },
    });
    getAuthenticatedClient.mockReturnValue({
      listPrompts,
      createPrompt,
    });
  });

  it('loads paginated prompts from the API client', async () => {
    listPrompts.mockResolvedValue({
      data: [
        {
          id: 'prompt_1',
          orgId: 'org_1',
          name: 'support-routing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        count: 75,
      },
    });

    const { default: PromptsPage } = await import('./page');
    render(await PromptsPage({ searchParams: Promise.resolve({}) }));

    expect(getAuthenticatedClient).toHaveBeenCalledWith('token');
    expect(listPrompts).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(screen.queryByText('No prompts yet')).not.toBeInTheDocument();
    expect(screen.getAllByText('support-routing').length).toBeGreaterThan(0);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/prompts?page=2');
  });

  it('respects the requested prompts page', async () => {
    listPrompts.mockResolvedValue({
      data: [],
      pagination: {
        page: 2,
        limit: 50,
        count: 75,
      },
    });

    const { default: PromptsPage } = await import('./page');
    render(await PromptsPage({ searchParams: Promise.resolve({ page: '2' }) }));

    expect(listPrompts).toHaveBeenCalledWith({ page: 2, limit: 50 });
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/prompts');
  });
});
