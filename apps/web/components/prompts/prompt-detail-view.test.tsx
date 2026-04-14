import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptDetailView } from './prompt-detail-view';

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
  it('renders prompt metadata and versions', () => {
    render(<PromptDetailView prompt={prompt} versions={versions} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByText('Prompt overview')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.getByText('Version 1')).toBeInTheDocument();
  });

  it('renders compare links to the prompt diff page', () => {
    render(<PromptDetailView prompt={prompt} versions={versions} />);

    expect(screen.getByRole('link', { name: /compare against v1/i })).toHaveAttribute(
      'href',
      '/prompts/pmt_123/diff?versionA=1&versionB=2',
    );
  });

  it('shows a warning state when no versions exist', () => {
    render(<PromptDetailView prompt={prompt} versions={[]} />);

    expect(screen.getByText('No prompt versions yet')).toBeInTheDocument();
    expect(screen.getByText(/Create at least two versions/)).toBeInTheDocument();
  });
});
