import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptDiffView } from './prompt-diff-view';

const versions = [
  {
    id: 'pmv_1',
    promptId: 'pmt_123',
    version: 1,
    content: 'Be concise.',
    model: 'gpt-4o-mini',
    config: { temperature: 0.1 },
    createdAt: new Date().toISOString(),
    createdBy: null,
    labels: ['production'],
  },
  {
    id: 'pmv_2',
    promptId: 'pmt_123',
    version: 2,
    content: 'Be concise and cite sources.',
    model: 'gpt-4o',
    config: { temperature: 0.2 },
    createdAt: new Date().toISOString(),
    createdBy: null,
    labels: ['staging'],
  },
];

describe('PromptDiffView', () => {
  it('renders the empty selection state when no diff is loaded', () => {
    render(
      <PromptDiffView
        promptName="support-agent"
        versions={versions}
        initialDiff={null}
      />,
    );

    expect(screen.getByText('Prompt Comparison')).toBeInTheDocument();
    expect(screen.getByText('Choose two versions')).toBeInTheDocument();
    expect(screen.getByText(/Select a baseline and comparison version/)).toBeInTheDocument();
  });

  it('renders a no-change state when selected versions match', () => {
    render(
      <PromptDiffView
        promptName="support-agent"
        versions={versions}
        initialVersionA={1}
        initialVersionB={2}
        initialDiff={{
          promptId: 'pmt_123',
          promptName: 'support-agent',
          versionA: 1,
          versionB: 2,
          changes: [],
          hasChanges: false,
        }}
      />,
    );

    expect(screen.getByText('No differences found')).toBeInTheDocument();
    expect(screen.getByText(/identical prompt content, model, and config/i)).toBeInTheDocument();
  });

  it('renders changed fields with before and after values', () => {
    render(
      <PromptDiffView
        promptName="support-agent"
        versions={versions}
        initialVersionA={1}
        initialVersionB={2}
        initialDiff={{
          promptId: 'pmt_123',
          promptName: 'support-agent',
          versionA: 1,
          versionB: 2,
          hasChanges: true,
          changes: [
            {
              field: 'content',
              before: 'Be concise.',
              after: 'Be concise and cite sources.',
            },
            {
              field: 'config',
              before: { temperature: 0.1 },
              after: { temperature: 0.2 },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('2 changed field(s)')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('config')).toBeInTheDocument();
    expect(screen.getByText('Be concise.')).toBeInTheDocument();
    expect(screen.getByText('Be concise and cite sources.')).toBeInTheDocument();
    expect(screen.getAllByText(/Before|After/)).toHaveLength(4);
  });
});
