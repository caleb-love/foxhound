import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptDiffView } from './prompt-diff-view';

const versions = [
  {
    id: 'pmv_2',
    promptId: 'pmt_123',
    version: 2,
    content: 'Be concise.',
    model: 'gpt-4o-mini',
    config: { temperature: 0.2 },
    createdAt: '2026-04-13T01:00:00.000Z',
    createdBy: null,
    labels: ['production'],
  },
  {
    id: 'pmv_1',
    promptId: 'pmt_123',
    version: 1,
    content: 'Be detailed.',
    model: 'gpt-4o',
    config: { temperature: 0.6 },
    createdAt: '2026-04-13T00:00:00.000Z',
    createdBy: null,
    labels: [],
  },
];

const initialDiff = {
  promptId: 'pmt_123',
  promptName: 'support-agent',
  versionA: 1,
  versionB: 2,
  hasChanges: true,
  changes: [
    { field: 'content', before: 'Be detailed.', after: 'Be concise.' },
    { field: 'config', before: { temperature: 0.6 }, after: { temperature: 0.2 } },
  ],
};

describe('PromptDiffView', () => {
  it('renders changed fields with before and after values', () => {
    render(<PromptDiffView promptName="support-agent" versions={versions as never} initialDiff={initialDiff as never} initialVersionA={1} initialVersionB={2} />);

    expect(screen.getByText('Prompt Comparison')).toBeInTheDocument();
    expect(screen.getByText('2 changed field(s)')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Be concise.')).toBeInTheDocument();
  });

  it('renders release review carry-forward action', () => {
    render(<PromptDiffView promptName="support-agent" versions={versions as never} initialDiff={initialDiff as never} initialVersionA={1} initialVersionB={2} />);

    expect(screen.getByRole('link', { name: /Carry this pair into release review/i })).toHaveAttribute(
      'href',
      '/prompts?baseline=1&comparison=2&focus=support-agent',
    );
  });

  it('shows a warning state when no diff is available', () => {
    render(<PromptDiffView promptName="support-agent" versions={versions as never} initialDiff={null} />);

    expect(screen.getByText(/Choose two versions/i)).toBeInTheDocument();
  });
});
