import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptListView } from './prompt-list-view';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const prompts = [
  {
    id: 'prompt_support_routing',
    name: 'support-routing',
    updatedAt: '2026-04-14T10:00:00.000Z',
  },
  {
    id: 'prompt_onboarding_router',
    name: 'onboarding-router',
    updatedAt: '2026-04-14T11:00:00.000Z',
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

    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search prompts, versions, or linked workflows...')).toBeInTheDocument();
    expect(screen.getByText('support-routing')).toBeInTheDocument();
    expect(screen.getByText('onboarding-router')).toBeInTheDocument();
  });

  it('respects active segment prompt filters', () => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'Support prompts',
      currentFilters: { ...defaults, promptIds: ['support-routing'] },
      savedSegments: [],
    });

    render(<PromptListView prompts={prompts} />);

    expect(screen.getByText('support-routing')).toBeInTheDocument();
    expect(screen.queryByText('onboarding-router')).not.toBeInTheDocument();
  });
});
