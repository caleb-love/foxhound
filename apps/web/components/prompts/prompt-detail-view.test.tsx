import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptDetailView } from './prompt-detail-view';

vi.mock('next/navigation', () => ({
  usePathname: () => '/prompts/pmt_123',
}));

const prompt = {
  id: 'pmt_123',
  orgId: 'org_1',
  name: 'support-agent',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const versions = [
  {
    id: 'pmv_1',
    promptId: 'pmt_123',
    version: 1,
    content: 'First prompt version',
    model: 'gpt-4o-mini',
    config: {},
    createdAt: '2026-04-13T00:00:00.000Z',
    createdBy: null,
    labels: ['production'],
  },
  {
    id: 'pmv_2',
    promptId: 'pmt_123',
    version: 2,
    content: 'Second prompt version',
    model: 'gpt-4o',
    config: {},
    createdAt: '2026-04-13T01:00:00.000Z',
    createdBy: null,
    labels: ['staging'],
  },
];

describe('PromptDetailView', () => {
  it('renders prompt name and version timeline', () => {
    render(<PromptDetailView prompt={prompt as never} versions={versions as never} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    // Version timeline should show both versions
    expect(screen.getAllByText('v2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('v1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders inline action buttons', () => {
    render(<PromptDetailView prompt={prompt as never} versions={versions as never} />);

    expect(screen.getByText('Compare latest')).toBeInTheDocument();
    expect(screen.getByText('Linked traces')).toBeInTheDocument();
  });

  it('shows the latest version content by default', () => {
    render(<PromptDetailView prompt={prompt as never} versions={versions as never} />);

    // Latest version (v2) content should be visible
    expect(screen.getByText('Second prompt version')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  it('shows a warning state when no versions exist', () => {
    render(<PromptDetailView prompt={prompt as never} versions={[] as never} />);

    expect(screen.getByText('No prompt versions yet')).toBeInTheDocument();
    expect(screen.getByText(/Create at least two versions/)).toBeInTheDocument();
  });
});
