import type { FleetActionItem } from "@/components/overview/fleet-overview-v2";
import type {
  ExecDecisionInput,
  ExecTalkingPoint,
} from "@/components/overview/executive-summary-v2";
import type { FleetMetrics } from "@/lib/verdict-engine";
import type { OpinionatedSuggestion } from "@/lib/decisions-queue-types";

/**
 * Canonical opinionated suggestion shown alongside the v18 → v19 promotion
 * decision. Lives at module scope so Fleet Overview's Action entry and the
 * Executive Summary's promotion decision quote the *same* proposed change.
 *
 * Reflects the demo's lead-with-risk story: failures concentrate on stale
 * context in the refund-policy flow; the fix is a prompt-level guard.
 */
const REFUND_POLICY_PROMPT_FIX: OpinionatedSuggestion = {
  framework: "claude-agent-sdk",
  summary:
    'Add a "use only provided refund-policy context" guard to the system prompt.',
  diff: [
    "  system: |",
    "    You are a returns and refunds support agent.",
    "+   Answer ONLY from the refund policy I provide in the next turn.",
    "+   If the policy does not cover the situation, say so and escalate.",
  ].join("\n"),
  expectedImpact:
    "faithful-to-context evaluator score expected to lift from 0.71 → ≥ 0.92 within 100 traces.",
};

interface FleetNarrativeOverrides {
  regressionContext?: string;
  slaContext?: string;
  budgetContext?: string;
  promotionContext?: string;
  regressionActions?: FleetActionItem["actions"];
  slaActions?: FleetActionItem["actions"];
  budgetActions?: FleetActionItem["actions"];
  promotionActions?: FleetActionItem["actions"];
}

interface ExecutiveNarrativeOverrides {
  promotionDecision?: Partial<ExecDecisionInput>;
  reliabilityDecision?: Partial<ExecDecisionInput>;
  budgetDecision?: Partial<ExecDecisionInput>;
}

export function buildFleetActionItems(
  metrics: FleetMetrics,
  hrefs: {
    traces: string;
    regressions: string;
    slas: string;
    budgets: string;
    prompts: string;
    experiments: string;
  },
  overrides?: FleetNarrativeOverrides,
): FleetActionItem[] {
  const items: FleetActionItem[] = [];

  if (metrics.criticalRegressions > 0) {
    items.push({
      title: `Investigate ${metrics.criticalRegressions} critical regression${metrics.criticalRegressions !== 1 ? "s" : ""}`,
      context:
        overrides?.regressionContext ??
        "Start with regressions and traces to confirm whether the newest failures reflect prompt drift, tool instability, or a release candidate that should be held back.",
      severity: "critical",
      agentIds: ["support-agent", "onboarding-router"],
      kind: "issue",
      actions: overrides?.regressionActions ?? [
        { label: "Regressions", href: hrefs.regressions },
        { label: "Traces", href: hrefs.traces },
      ],
    });

    items.push({
      title: "Failure cluster: stale-context answers in refund-policy flow",
      context:
        "47 traces failed the faithful-to-context evaluator in the last 24h. Retrieval succeeded; the LLM answered from prior knowledge. This is a prompt issue, not a retrieval issue.",
      severity: "warning",
      agentIds: ["support-agent"],
      kind: "insight",
      actions: [
        { label: "Open evaluator", href: hrefs.experiments },
        { label: "Trace cluster", href: hrefs.traces },
      ],
    });

    items.push({
      title: "Tighten the refund-policy prompt against stale-context answers",
      context:
        "Proposed prompt edit closes the cluster Foxhound just surfaced. Approve, edit, or reject — the diff applies in your repo, not in Foxhound.",
      severity: "warning",
      agentIds: ["support-agent"],
      kind: "action",
      suggestion: REFUND_POLICY_PROMPT_FIX,
      actions: [
        { label: "Open prompt", href: hrefs.prompts },
        { label: "Compare runs", href: hrefs.experiments },
      ],
    });
  }

  if (metrics.slaRisks > 0) {
    items.push({
      title: `Review ${metrics.slaRisks} SLA risk${metrics.slaRisks !== 1 ? "s" : ""}`,
      context:
        overrides?.slaContext ??
        "Latency and success-rate posture now warrant direct inspection before the next release or traffic increase.",
      severity: metrics.slaRisks > 2 ? "critical" : "warning",
      agentIds: ["planner-agent", "support-agent"],
      kind: "issue",
      actions: overrides?.slaActions ?? [
        { label: "SLAs", href: hrefs.slas },
        { label: "Traces", href: hrefs.traces },
      ],
    });
  }

  if (metrics.budgetOverspendUsd > 0) {
    items.push({
      title: `Contain $${metrics.budgetOverspendUsd} projected overspend`,
      context:
        overrides?.budgetContext ??
        "Inspect the cost hotspots before approving further rollout or promotion, especially if the improvement case is not yet decisive.",
      severity: metrics.budgetOverspendUsd > 500 ? "critical" : "warning",
      agentIds: ["support-agent", "planner-agent"],
      kind: "issue",
      actions: overrides?.budgetActions ?? [
        { label: "Budgets", href: hrefs.budgets },
        { label: "Experiments", href: hrefs.experiments },
      ],
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Review healthy release candidates",
      context:
        overrides?.promotionContext ??
        "No fleet-level blockers are active. Use experiments and prompt history to validate whether the next promotion is worth shipping.",
      severity: "healthy",
      agentIds: ["support-agent"],
      kind: "insight",
      actions: overrides?.promotionActions ?? [
        { label: "Experiments", href: hrefs.experiments },
        { label: "Prompts", href: hrefs.prompts },
      ],
    });
  } else {
    items.push({
      title: "Validate promotion-ready candidates",
      context:
        overrides?.promotionContext ??
        "Once active regressions and SLA pressure are understood, compare the current candidate set before changing any prompt labels or release posture.",
      severity: "healthy",
      agentIds: ["support-agent"],
      kind: "insight",
      actions: overrides?.promotionActions ?? [
        { label: "Experiments", href: hrefs.experiments },
        { label: "Prompts", href: hrefs.prompts },
      ],
    });
  }

  return items;
}

export function buildExecutiveDecisions(
  metrics: FleetMetrics,
  hrefs: {
    experiments: string;
    regressions: string;
    budgets: string;
  },
  overrides?: ExecutiveNarrativeOverrides,
): ExecDecisionInput[] {
  const decisions: ExecDecisionInput[] = [];

  decisions.push({
    title:
      overrides?.promotionDecision?.title ??
      "Should the current leading candidate move toward promotion?",
    status:
      overrides?.promotionDecision?.status ??
      (metrics.criticalRegressions > 0 ? "watch" : "on-track"),
    evidence:
      overrides?.promotionDecision?.evidence ??
      (metrics.criticalRegressions > 0
        ? `${metrics.criticalRegressions} critical regression${metrics.criticalRegressions !== 1 ? "s remain" : " remains"} in the fleet, so experiment evidence should be reviewed before approving any release decision.`
        : "No critical regressions are currently blocking candidate review, so experiment evidence can be weighed more directly against cost and readiness."),
    recommendation:
      overrides?.promotionDecision?.recommendation ??
      (metrics.criticalRegressions > 0
        ? "Review experiments before promotion"
        : "Promote with monitoring"),
    href: overrides?.promotionDecision?.href ?? hrefs.experiments,
    cta: overrides?.promotionDecision?.cta ?? "Review experiments",
    kind: overrides?.promotionDecision?.kind ?? "action",
    suggestion:
      overrides?.promotionDecision?.suggestion ??
      (metrics.criticalRegressions > 0 ? REFUND_POLICY_PROMPT_FIX : undefined),
  });

  decisions.push({
    title:
      overrides?.reliabilityDecision?.title ??
      "Is reliability stable enough for the next release window?",
    status:
      overrides?.reliabilityDecision?.status ?? (metrics.slaRisks > 0 ? "attention" : "on-track"),
    evidence:
      overrides?.reliabilityDecision?.evidence ??
      (metrics.slaRisks > 0
        ? `${metrics.slaRisks} SLA risk${metrics.slaRisks !== 1 ? "s are" : " is"} active, which means latency or success-rate drift is still visible at operator level.`
        : "No active SLA risks are visible, so reliability is not the primary blocker for the next release decision."),
    recommendation:
      overrides?.reliabilityDecision?.recommendation ??
      (metrics.slaRisks > 0
        ? "Hold releases until reliability stabilizes"
        : "No reliability hold required"),
    href: overrides?.reliabilityDecision?.href ?? hrefs.regressions,
    cta: overrides?.reliabilityDecision?.cta ?? "Review regressions",
    kind: overrides?.reliabilityDecision?.kind ?? (metrics.slaRisks > 0 ? "issue" : "action"),
  });

  decisions.push({
    title: overrides?.budgetDecision?.title ?? "Does cost posture support more rollout pressure?",
    status:
      overrides?.budgetDecision?.status ??
      (metrics.budgetOverspendUsd > 500
        ? "attention"
        : metrics.budgetOverspendUsd > 0
          ? "watch"
          : "on-track"),
    evidence:
      overrides?.budgetDecision?.evidence ??
      (metrics.budgetOverspendUsd > 0
        ? `$${metrics.budgetOverspendUsd} projected overspend is currently visible in the fleet metrics, so cost should stay inside the release discussion.`
        : "Budget posture is currently on track, so cost is not the leading blocker in the next release call."),
    recommendation:
      overrides?.budgetDecision?.recommendation ??
      (metrics.budgetOverspendUsd > 0
        ? "Review budgets before expanding traffic"
        : "No additional budget action required"),
    href: overrides?.budgetDecision?.href ?? hrefs.budgets,
    cta: overrides?.budgetDecision?.cta ?? "View budgets",
    kind: overrides?.budgetDecision?.kind ?? (metrics.budgetOverspendUsd > 0 ? "issue" : "action"),
  });

  return decisions;
}

export function buildExecutiveTalkingPoints(
  metrics: FleetMetrics,
  connectedSurfaceSummary: string,
  evidenceHighlights: string[] = [],
): ExecTalkingPoint[] {
  const points: ExecTalkingPoint[] = [];

  if (metrics.previousHealthPercent !== undefined) {
    const delta = metrics.healthPercent - metrics.previousHealthPercent;
    if (delta < 0) {
      points.push({
        text: `Fleet reliability moved down ${Math.abs(delta)} points period-over-period, so release readiness should be framed as a recovery and containment story, not a pure growth story.`,
      });
    } else if (delta > 0) {
      points.push({
        text: `Fleet reliability moved up ${delta} points period-over-period, which supports a more aggressive review of promotion-ready candidates if cost and regression posture stay controlled.`,
      });
    }
  }

  if (metrics.criticalRegressions > 0) {
    points.push({
      text: `${metrics.criticalRegressions} critical regression${metrics.criticalRegressions !== 1 ? "s remain" : " remains"} the main executive risk signal and should anchor the top-level review narrative.`,
    });
  }

  if (metrics.budgetOverspendUsd > 0) {
    points.push({
      text: `Cost pressure is still present at $${metrics.budgetOverspendUsd} projected overspend, so improvement wins should be discussed together with budget posture, not in isolation.`,
    });
  }

  for (const highlight of evidenceHighlights) {
    points.push({ text: highlight });
  }

  points.push({ text: connectedSurfaceSummary });

  return points.slice(0, 3);
}
