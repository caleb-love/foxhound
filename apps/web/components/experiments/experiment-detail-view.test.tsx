import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentDetailView } from './experiment-detail-view';

const experiment = {
  id: 'exp_1',
  orgId: 'org_1',
  datasetId: 'ds_1',
  name: 'support-routing-v13-candidate',
  config: {
    candidatePromptVersion: 13,
    baselinePromptVersion: 12,
    targetPromptId: 'pmt_support_routing',
    targetPromptName: 'support-routing',
  },
  status: 'completed',
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  runs: [
    {
      id: 'run_1',
      experimentId: 'exp_1',
      datasetItemId: 'dsi_1',
      latencyMs: 840,
      tokenCount: 320,
      cost: 0.0123,
      output: { action: 'escalate', confidence: 0.91 },
      createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    },
  ],
};

describe('ExperimentDetailView', () => {
  it('renders experiment detail stats and attached runs', () => {
    render(<ExperimentDetailView experiment={experiment as never} datasetName="support-routing-regressions" />);

    expect(screen.getByText('support-routing-v13-candidate')).toBeInTheDocument();
    expect(screen.getByText('Attached experiment runs')).toBeInTheDocument();
    expect(screen.getByText('run_1')).toBeInTheDocument();
    expect(screen.getByText('840ms')).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
    expect(screen.getByText('$0.0123')).toBeInTheDocument();
    expect(screen.getByText(/output captured/i)).toBeInTheDocument();
  });

  it('renders release decision framing and promotion actions', () => {
    render(<ExperimentDetailView experiment={experiment as never} datasetName="support-routing-regressions" />);

    expect(screen.getByText('Release decision framing')).toBeInTheDocument();
    expect(screen.getByText('support-routing')).toBeInTheDocument();
    expect(screen.getByText('v12')).toBeInTheDocument();
    expect(screen.getByText('v13')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review candidate vs baseline prompt/i })).toHaveAttribute(
      'href',
      '/prompts/pmt_support_routing/diff?versionA=12&versionB=13',
    );
  });

  it('renders pending guidance when no runs are attached', () => {
    render(<ExperimentDetailView experiment={{ ...experiment, runs: [], status: 'pending' } as never} datasetName="support-routing-regressions" />);

    expect(screen.getByText(/No runs are attached yet/i)).toBeInTheDocument();
  });
});
