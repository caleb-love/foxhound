import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptListView } from './prompt-list-view';

const prompts = [
  {
    id: 'pmt_b',
    orgId: 'org_1',
    name: 'zebra-agent',
    createdAt: new Date().toISOString(),
    updatedAt: '2026-04-13T02:00:00.000Z',
  },
  {
    id: 'pmt_a',
    orgId: 'org_1',
    name: 'alpha-agent',
    createdAt: new Date().toISOString(),
    updatedAt: '2026-04-13T01:00:00.000Z',
  },
];

describe('PromptListView', () => {
  it('renders prompts sorted by name', () => {
    render(<PromptListView prompts={prompts} />);

    const alpha = screen.getByText('alpha-agent');
    const zebra = screen.getByText('zebra-agent');
    expect(alpha.compareDocumentPosition(zebra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders links to prompt detail pages', () => {
    render(<PromptListView prompts={prompts} />);

    const links = screen.getAllByRole('link', { name: /view prompt/i });
    expect(links[0]).toHaveAttribute('href', '/prompts/pmt_a');
    expect(links[1]).toHaveAttribute('href', '/prompts/pmt_b');
  });

  it('shows focused prompt context when provided', () => {
    render(<PromptListView prompts={prompts} focusedPromptName="alpha-agent" />);

    expect(screen.getByText('Focused')).toBeInTheDocument();
    expect(screen.getByText(/Focused from another workflow:/)).toBeInTheDocument();
    expect(screen.getAllByText('alpha-agent').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no prompts', () => {
    render(<PromptListView prompts={[]} />);

    expect(screen.getByText('No prompts yet')).toBeInTheDocument();
    expect(screen.getByText(/Create a prompt in the API first/)).toBeInTheDocument();
  });
});
