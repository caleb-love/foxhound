import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptListView } from './prompt-list-view';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const prompts = [
  {
    id: 'prompt_support_routing',
    orgId: 'org_1',
    name: 'support-routing',
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prompt_onboarding_router',
    orgId: 'org_1',
    name: 'onboarding-router',
    createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prompt_legacy',
    orgId: 'org_1',
    name: 'legacy-prompt',
    createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
] as never;

describe('PromptListView', () => {
  beforeEach(() => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
  });

  it('renders prompts and shared filter bar', () => {
    render(<PromptListView prompts={prompts} />);

    expect(screen.getByRole('heading', { name: 'Prompts' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search prompts...')).toBeInTheDocument();
    expect(screen.queryByText('No prompts yet')).not.toBeInTheDocument();
    expect(screen.getAllByText('support-routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('onboarding-router').length).toBeGreaterThan(0);
  });

  it('respects active segment prompt filters', () => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'Support prompts',
      currentFilters: { ...defaults, promptIds: ['support-routing'] },
      savedSegments: [],
    });

    render(<PromptListView prompts={prompts} />);

    expect(screen.queryByText('No prompts yet')).not.toBeInTheDocument();
    expect(screen.getAllByText('support-routing').length).toBeGreaterThan(0);
    expect(screen.queryByText('onboarding-router')).not.toBeInTheDocument();
  });

  it('renders pagination controls for live dashboard prompts', () => {
    render(
      <PromptListView
        prompts={prompts}
        pagination={{ page: 1, limit: 50, count: 120 }}
      />,
    );

    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/prompts');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/prompts?page=2');
  });

  it('does not hide older prompts under the default global date range', () => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });

    render(<PromptListView prompts={prompts} />);

    expect(screen.getAllByText('support-routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('onboarding-router').length).toBeGreaterThan(0);
    expect(screen.getByText('legacy-prompt')).toBeInTheDocument();
  });
});
