import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionImpactStrip, type VersionImpact } from './version-impact-strip';

describe('VersionImpactStrip', () => {
  it('renders nothing when impact is null', () => {
    const { container } = render(<VersionImpactStrip impact={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows version transition label', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 80, errorRate: 0.08, avgCostUsd: 0.03, avgDurationMs: 1500 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getByText(/v17 → v18/)).toBeInTheDocument();
  });

  it('shows regression badge when error rate increases', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 100, errorRate: 0.10, avgCostUsd: 0.05, avgDurationMs: 2000 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getByText('Regression')).toBeInTheDocument();
  });

  it('shows improved badge when cost decreases', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.02, avgCostUsd: 0.10, avgDurationMs: 3000 },
      after: { traceCount: 100, errorRate: 0.01, avgCostUsd: 0.04, avgDurationMs: 1500 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getByText('Improved')).toBeInTheDocument();
  });

  it('shows before and after values for error rate', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 100, errorRate: 0.08, avgCostUsd: 0.05, avgDurationMs: 2000 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getByText('2.0%')).toBeInTheDocument();
    expect(screen.getByText('8.0%')).toBeInTheDocument();
  });

  it('shows delta badges with directional indicators', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 100, errorRate: 0.08, avgCostUsd: 0.03, avgDurationMs: 1500 },
    };
    render(<VersionImpactStrip impact={impact} />);
    // Error rate went up +6.0pp
    expect(screen.getByText('+6.0pp')).toBeInTheDocument();
    // Cost went down -40%
    expect(screen.getByText('-40%')).toBeInTheDocument();
  });

  it('shows trace count delta', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 200, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 150, errorRate: 0.02, avgCostUsd: 0.05, avgDurationMs: 2000 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getByText('-50')).toBeInTheDocument();
  });

  it('shows "No change" for metrics that did not change', () => {
    const impact: VersionImpact = {
      fromVersion: 17,
      toVersion: 18,
      before: { traceCount: 100, errorRate: 0.05, avgCostUsd: 0.05, avgDurationMs: 2000 },
      after: { traceCount: 100, errorRate: 0.05, avgCostUsd: 0.05, avgDurationMs: 2000 },
    };
    render(<VersionImpactStrip impact={impact} />);
    expect(screen.getAllByText('No change').length).toBeGreaterThanOrEqual(3);
  });
});
