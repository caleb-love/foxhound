/**
 * Verdict Engine
 *
 * Pure functions that compute fleet-level and executive-level verdicts
 * from platform metrics. No side effects, no component dependencies.
 *
 * Used by FleetOverview (VerdictBar) and ExecutiveSummary (RAG indicator).
 */

export type VerdictSeverity = 'healthy' | 'warning' | 'critical';
export type RagStatus = 'green' | 'amber' | 'red';

export interface FleetMetrics {
  healthPercent: number;
  previousHealthPercent?: number;
  criticalRegressions: number;
  previousCriticalRegressions?: number;
  slaRisks: number;
  previousSlaRisks?: number;
  budgetOverspendUsd: number;
  previousBudgetOverspendUsd?: number;
}

export interface VerdictAction {
  label: string;
  href: string;
}

export interface FleetVerdict {
  severity: VerdictSeverity;
  headline: string;
  narrative: string;
  actions: VerdictAction[];
}

export interface ExecutiveVerdict {
  rag: RagStatus;
  headline: string;
  subheadline: string;
}

export interface MetricDelta {
  direction: 'up' | 'down' | 'flat';
  label: string;
  isRegression: boolean;
}

// ---------------------------------------------------------------------------
// Fleet Verdict
// ---------------------------------------------------------------------------

export function computeFleetVerdict(metrics: FleetMetrics): FleetVerdict {
  const { criticalRegressions, slaRisks } = metrics;

  const severity = computeSeverity(metrics);
  const headline = buildHeadline(severity, criticalRegressions, slaRisks);
  const narrative = buildNarrative(metrics);
  const actions = buildActions(metrics);

  return { severity, headline, narrative, actions };
}

function computeSeverity(m: FleetMetrics): VerdictSeverity {
  if (m.criticalRegressions > 0 && m.slaRisks > 0) return 'critical';
  if (m.criticalRegressions > 0) return 'critical';
  if (m.slaRisks > 2 || m.budgetOverspendUsd > 500) return 'warning';
  if (m.slaRisks > 0 || m.budgetOverspendUsd > 0) return 'warning';
  return 'healthy';
}

function buildHeadline(severity: VerdictSeverity, regressions: number, slaRisks: number): string {
  if (severity === 'critical') {
    const parts: string[] = [];
    if (regressions > 0) parts.push(`${regressions} critical regression${regressions > 1 ? 's' : ''}`);
    if (slaRisks > 0) parts.push(`${slaRisks} SLA risk${slaRisks > 1 ? 's' : ''}`);
    return `${parts.join(' and ')} need investigation`;
  }
  if (severity === 'warning') {
    return 'Fleet healthy with active risks under review';
  }
  return 'Fleet healthy, no action required';
}

function buildNarrative(m: FleetMetrics): string {
  const parts: string[] = [];

  // Health trend
  if (m.previousHealthPercent !== undefined) {
    const delta = m.healthPercent - m.previousHealthPercent;
    if (delta < 0) {
      parts.push(`Fleet is ${m.healthPercent}% healthy, down from ${m.previousHealthPercent}% previously.`);
    } else if (delta > 0) {
      parts.push(`Fleet is ${m.healthPercent}% healthy, up from ${m.previousHealthPercent}% previously.`);
    } else {
      parts.push(`Fleet is holding at ${m.healthPercent}% healthy.`);
    }
  } else {
    parts.push(`Fleet is ${m.healthPercent}% healthy.`);
  }

  // Regressions
  if (m.criticalRegressions > 0) {
    parts.push(`${m.criticalRegressions} critical regression${m.criticalRegressions > 1 ? 's' : ''} detected.`);
  }

  // SLA
  if (m.slaRisks > 0) {
    parts.push(`${m.slaRisks} agent${m.slaRisks > 1 ? 's' : ''} trending toward SLA breach.`);
  }

  // Budget
  if (m.budgetOverspendUsd > 0) {
    parts.push(`$${m.budgetOverspendUsd} projected overspend.`);
  } else {
    parts.push('Budget is on track.');
  }

  return parts.join(' ');
}

function buildActions(m: FleetMetrics): VerdictAction[] {
  const actions: VerdictAction[] = [];

  if (m.criticalRegressions > 0) {
    actions.push({ label: 'Investigate regressions', href: '/regressions' });
  }
  if (m.slaRisks > 0) {
    actions.push({ label: 'Review SLA risks', href: '/slas' });
  }
  if (m.budgetOverspendUsd > 0) {
    actions.push({ label: 'Open budgets', href: '/budgets' });
  }
  if (actions.length === 0) {
    actions.push({ label: 'View traces', href: '/traces' });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Executive Verdict (RAG)
// ---------------------------------------------------------------------------

export function computeExecutiveVerdict(metrics: FleetMetrics): ExecutiveVerdict {
  const rag = computeRag(metrics);
  const headline = buildRagHeadline(rag, metrics);
  const subheadline = buildRagSubheadline(metrics);

  return { rag, headline, subheadline };
}

function computeRag(m: FleetMetrics): RagStatus {
  // Red: active SLA breaches AND unresolved critical regressions
  if (m.slaRisks > 0 && m.criticalRegressions > 0) return 'red';
  // Amber: any critical regression OR any SLA risk OR large overspend
  if (m.criticalRegressions > 0 || m.slaRisks > 0 || m.budgetOverspendUsd > 500) return 'amber';
  // Amber: minor overspend
  if (m.budgetOverspendUsd > 0) return 'amber';
  return 'green';
}

function buildRagHeadline(rag: RagStatus, m: FleetMetrics): string {
  if (rag === 'red') {
    return `Critical: ${m.criticalRegressions} regression${m.criticalRegressions > 1 ? 's' : ''} with active SLA risk`;
  }
  if (rag === 'amber') {
    const issues: string[] = [];
    if (m.criticalRegressions > 0) issues.push(`${m.criticalRegressions} active risk${m.criticalRegressions > 1 ? 's' : ''}`);
    else if (m.slaRisks > 0) issues.push(`${m.slaRisks} SLA risk${m.slaRisks > 1 ? 's' : ''}`);
    if (m.budgetOverspendUsd > 0) issues.push(`$${m.budgetOverspendUsd} over budget`);
    return `Platform healthy with ${issues.join(', ')}`;
  }
  return 'Platform healthy, no action required';
}

function buildRagSubheadline(m: FleetMetrics): string {
  if (m.previousHealthPercent !== undefined) {
    const delta = m.healthPercent - m.previousHealthPercent;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    if (direction !== 'flat') {
      return `Reliability ${direction} ${Math.abs(delta)}pp from last period`;
    }
  }
  return `${m.healthPercent}% reliability this period`;
}

// ---------------------------------------------------------------------------
// Metric Delta Computation
// ---------------------------------------------------------------------------

export function computeDelta(
  current: number,
  previous: number | undefined,
  higherIsBetter: boolean,
): MetricDelta | null {
  if (previous === undefined) return null;

  const diff = current - previous;
  if (diff === 0) return { direction: 'flat', label: 'No change', isRegression: false };

  const direction: 'up' | 'down' = diff > 0 ? 'up' : 'down';
  const absDiff = Math.abs(diff);

  // Format the label
  const isPercent = current <= 100 && previous <= 100 && current >= 0 && previous >= 0;
  const label = isPercent
    ? `${direction === 'up' ? '+' : '-'}${absDiff}pp`
    : `${direction === 'up' ? '+' : '-'}${absDiff}`;

  const isRegression = higherIsBetter ? direction === 'down' : direction === 'up';

  return { direction, label, isRegression };
}
