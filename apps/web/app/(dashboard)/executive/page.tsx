import { ExecutiveSummaryDashboard, type ExecutiveMetric, type ExecutiveDecisionItem } from '@/components/overview/executive-summary-dashboard';

const metrics: ExecutiveMetric[] = [
  {
    label: 'Platform health',
    value: '92%',
    supportingText: 'Most monitored workflows remain healthy, with a small set of targeted risks to resolve.',
  },
  {
    label: 'Critical risks',
    value: '2',
    supportingText: 'Two issues need active review before the next release decision.',
  },
  {
    label: 'Projected overspend',
    value: '$182',
    supportingText: 'Current cost drift is manageable if the top hotspot is addressed quickly.',
  },
  {
    label: 'Promotion-ready changes',
    value: '1',
    supportingText: 'One candidate looks safe to promote pending final review.',
  },
];

const decisions: ExecutiveDecisionItem[] = [
  {
    title: 'Decide whether support-routing v12 is safe to promote',
    status: 'watch',
    description: 'Latency improved, but cost rose slightly and needs a final evaluator review.',
    href: '/experiments',
    cta: 'Open experiments',
  },
  {
    title: 'Review planner-agent reliability drift',
    status: 'attention',
    description: 'Regression and SLA pages both indicate the same high-priority reliability issue.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Confirm budget protections before the next release',
    status: 'on-track',
    description: 'Budget guardrails are in place, but one hotspot should be reduced before traffic increases.',
    href: '/budgets',
    cta: 'Open budgets',
  },
];

const highlights = [
  'Support workflows improved on latency, but cost efficiency still needs validation.',
  'Planner reliability remains the main risk to customer-facing stability.',
  'The dashboard now has connected operator surfaces across overview, investigate, improve, and govern workflows.',
];

export default function ExecutivePage() {
  return <ExecutiveSummaryDashboard metrics={metrics} decisions={decisions} highlights={highlights} />;
}
