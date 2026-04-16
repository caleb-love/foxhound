import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegressionsDashboard } from './regressions-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const regressions = [
  { id: 'reg_1', title: 'Refund policy check regression', severity: 'critical', traceId: 'tr_1', diffPairId: 'tr_0', promptName: 'refund-policy', summary: 'Policy check step started failing after prompt v7' },
  { id: 'reg_2', title: 'Onboarding latency spike', severity: 'warning', traceId: 'tr_2', diffPairId: 'tr_1', summary: 'Onboarding flow 40% slower after model swap' },
];

describe('RegressionsDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders regression cards with titles and severity', () => {
    render(<RegressionsDashboard regressions={regressions} />);

    expect(screen.getByText('Refund policy check regression')).toBeInTheDocument();
    expect(screen.getByText('Onboarding latency spike')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('shows verdict about critical regressions', () => {
    render(<RegressionsDashboard regressions={regressions} />);

    expect(screen.getByText(/1 critical regression detected/)).toBeInTheDocument();
  });

  it('shows no-regressions state when fleet is stable', () => {
    render(<RegressionsDashboard regressions={[]} />);

    expect(screen.getAllByText(/No regressions detected/).length).toBeGreaterThanOrEqual(1);
  });
});
