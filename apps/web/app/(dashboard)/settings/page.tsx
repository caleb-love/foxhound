import { SettingsGovernDashboard, type SettingsControlRecord, type SettingsMetric } from '@/components/settings/settings-govern-dashboard';

const metrics: SettingsMetric[] = [
  {
    label: 'Governance controls',
    value: '8',
    supportingText: 'Operational control surfaces currently shaping routing, reliability, and escalation behavior.',
  },
  {
    label: 'Needs review',
    value: '2',
    supportingText: 'Two controls are drifting from the intended operating model and need attention.',
  },
  {
    label: 'Security-sensitive',
    value: '3',
    supportingText: 'Three controls directly influence access, webhook trust, or escalation paths.',
  },
  {
    label: 'Primary owner',
    value: 'platform-ops',
    supportingText: 'Most governance changes still route through the platform operating team.',
  },
];

const controls: SettingsControlRecord[] = [
  {
    name: 'Escalation routing policy',
    category: 'notifications',
    status: 'warning',
    summary: 'Critical regression and SLA alerts still route correctly, but budget escalations are noisier than intended and need tighter ownership rules.',
    lastChanged: '2 days ago',
    href: '/notifications',
    owner: 'platform-ops',
  },
  {
    name: 'Reliability guardrail thresholds',
    category: 'slas',
    status: 'critical',
    summary: 'Planner-agent breach thresholds no longer match current latency expectations, creating alert churn and slower triage.',
    lastChanged: 'yesterday',
    href: '/slas',
    owner: 'reliability-team',
  },
  {
    name: 'Behavior regression review loop',
    category: 'regressions',
    status: 'healthy',
    summary: 'Regression detection is wired into diff and replay workflows, and the highest-priority issues already carry strong investigation handoffs.',
    lastChanged: 'today',
    href: '/regressions',
    owner: 'platform-ops',
  },
  {
    name: 'Budget response thresholds',
    category: 'budgets',
    status: 'healthy',
    summary: 'Cost pressure thresholds are still catching true hotspots early enough to route operators into traces and improvement flows.',
    lastChanged: '3 days ago',
    href: '/budgets',
    owner: 'platform-ops',
  },
  {
    name: 'Webhook delivery trust boundary',
    category: 'security',
    status: 'warning',
    summary: 'Executive digest delivery is missing recent confirmation, so downstream trust in summary delivery should be revalidated before relying on it.',
    lastChanged: 'yesterday',
    href: '/notifications',
    owner: 'security-review',
  },
];

const nextActions = [
  {
    title: 'Tighten reliability threshold ownership',
    description: 'Confirm which team owns the planner-agent SLA thresholds and reduce noisy breach conditions before the next incident.',
    href: '/slas',
    cta: 'Open SLAs',
  },
  {
    title: 'Review notification trust boundaries',
    description: 'Validate delivery confidence for critical and executive escalation channels before assuming the current routing policy is sufficient.',
    href: '/notifications',
    cta: 'Open notifications',
  },
  {
    title: 'Verify cost and regression controls still align',
    description: 'Make sure budget-response and behavior-regression loops still reinforce one another instead of producing disconnected operator workflows.',
    href: '/regressions',
    cta: 'Open regressions',
  },
];

export default function SettingsPage() {
  return <SettingsGovernDashboard metrics={metrics} controls={controls} nextActions={nextActions} />;
}
