import type {
  DemoTrace as Trace,
  DemoSpan as Span,
  DemoBudgetFixture,
  DemoCuratedTrace,
  DemoDataset,
  DemoDiffPair,
  DemoEvaluator,
  DemoExperiment,
  DemoNotificationFixture,
  DemoOrg,
  DemoPrompt,
  DemoRegression,
  DemoScenario,
  DemoSlaFixture,
  LocalReviewDemo,
  MarketingHeroDemo,
} from "./types.js";

function makeSpan(
  traceId: string,
  spanId: string,
  name: string,
  kind: Span["kind"],
  startTimeMs: number,
  durationMs: number,
  status: Span["status"],
  attributes: Span["attributes"],
  parentSpanId?: string,
): Span {
  return {
    traceId,
    spanId,
    parentSpanId,
    name,
    kind,
    startTimeMs,
    endTimeMs: startTimeMs + durationMs,
    status,
    attributes,
    events: [],
  };
}

function makeSupportTrace(params: {
  id: string;
  agentId: string;
  promptName: string;
  promptVersion: number;
  issueType: string;
  customerTier: string;
  releaseVersion: string;
  totalCost: number;
  durationMs: number;
  escalationRequired: boolean;
  policyResult: string;
  kbTimeout?: boolean;
  llmFailure?: boolean;
  qualityScore?: number;
  sessionSuffix?: string;
}): Trace {
  const start = 1713000000000 + (params.promptVersion * 100000);
  const traceId = params.id;
  const workflowDuration = params.durationMs;
  const hasError = Boolean(params.kbTimeout || params.llmFailure || params.policyResult.includes("incorrect") || params.policyResult.includes("hallucinated") || params.policyResult.includes("missed"));
  const qualityScore = params.qualityScore ?? (hasError ? 0.48 : 0.93);

  const spans: Span[] = [
    makeSpan(traceId, "workflow_1", "Handle Support Ticket", "workflow", start, workflowDuration, hasError ? "error" : "ok", {
      workflow: "support_ticket",
      issue_type: params.issueType,
    }),
    makeSpan(traceId, "llm_1", "Classify Intent", "llm_call", start + 100, 900, "ok", {
      model: params.promptVersion >= 18 ? "gpt-4o-mini" : "gpt-4o",
      input_tokens: 420,
      output_tokens: 56,
      cost: 0.0042,
    }, "workflow_1"),
    makeSpan(traceId, "tool_1", "Retrieve Customer Context", "tool_call", start + 1100, 600, "ok", {
      tool: "customer_profile_lookup",
      latency_ms: 600,
      result_count: 1,
    }, "workflow_1"),
    makeSpan(traceId, "tool_2", "Search Policy Knowledge Base", "tool_call", start + 1800, params.kbTimeout ? 2200 : 1200, params.kbTimeout ? "error" : "ok", {
      tool: "policy_kb_search",
      latency_ms: params.kbTimeout ? 2200 : 1200,
      result_count: params.kbTimeout ? 0 : 4,
      timeout: params.kbTimeout ? true : null,
    }, "workflow_1"),
    makeSpan(traceId, "llm_2", "Generate Draft Response", "llm_call", start + 4200, params.llmFailure ? 2400 : 1800, params.llmFailure ? "error" : "ok", {
      model: params.promptVersion >= 18 ? "gpt-4o-mini" : "gpt-4o",
      input_tokens: 1260,
      output_tokens: 240,
      cost: Number((params.totalCost * 0.45).toFixed(4)),
      temperature: 0.2,
    }, "workflow_1"),
    makeSpan(traceId, "step_1", params.issueType === "refund" ? "Check Refund Eligibility" : "Policy Decision", "agent_step", start + 6700, 700, hasError ? "error" : "ok", {
      policy_result: params.policyResult,
      confidence: hasError ? 0.42 : 0.91,
      escalation_required: params.escalationRequired,
    }, "workflow_1"),
    makeSpan(traceId, "step_2", "Escalation Decision", "agent_step", start + 7500, 500, hasError && params.escalationRequired ? "error" : "ok", {
      escalation_required: params.escalationRequired,
      quality_score: qualityScore,
    }, "workflow_1"),
    makeSpan(traceId, "llm_3", "Finalize Response", "llm_call", start + 8100, Math.max(600, workflowDuration - 8100), hasError ? "error" : "ok", {
      model: params.promptVersion >= 18 ? "gpt-4o-mini" : "gpt-4o",
      input_tokens: 890,
      output_tokens: 210,
      cost: Number((params.totalCost * 0.55).toFixed(4)),
      temperature: 0.2,
    }, "workflow_1"),
  ];

  return {
    id: traceId,
    agentId: params.agentId,
    sessionId: `session_${params.sessionSuffix ?? params.issueType}`,
    startTimeMs: start,
    endTimeMs: start + workflowDuration,
    spans,
    metadata: {
      workflow: "support_ticket",
      environment: "production",
      issue_type: params.issueType,
      customer_tier: params.customerTier,
      prompt_name: params.promptName,
      prompt_version: params.promptVersion,
      release_version: params.releaseVersion,
      model_provider: "openai",
      model_name: params.promptVersion >= 18 ? "gpt-4o-mini" : "gpt-4o",
      ticket_id: `ticket_${params.issueType}_${params.promptVersion}_${params.sessionSuffix ?? "default"}`,
      language: "en",
      user_id: `customer_${params.issueType}`,
    },
  };
}

export const demoOrgs: DemoOrg[] = [
  {
    id: "org_support_copilot",
    name: "Support Copilot",
    slug: "support-copilot",
    plan: "team",
    llmEvaluationEnabled: true,
    role: "primary",
    description: "Hero demo org for support observability, regressions, and improvement workflows.",
  },
];

export const supportCopilotPrompts: DemoPrompt[] = [
  {
    id: "prompt_support_reply",
    name: "support-reply",
    purpose: "Primary support response generation prompt.",
    versions: [
      { version: 17, model: "gpt-4o", summary: "Stable baseline", narrativeRole: "last known good" },
      { version: 18, model: "gpt-4o-mini", summary: "Cost-optimized regression", narrativeRole: "cheaper and faster, but worse on refunds and escalations" },
      { version: 19, model: "gpt-4o-mini", summary: "Corrected recovery", narrativeRole: "restores quality at acceptable cost" },
    ],
  },
  {
    id: "prompt_refund_policy_check",
    name: "refund-policy-check",
    purpose: "Refund-specific policy interpretation prompt.",
    versions: [
      { version: 3, model: "gpt-4o", summary: "Stable baseline", narrativeRole: "last known good refund policy interpretation" },
      { version: 4, model: "gpt-4o-mini", summary: "Overly strict interpretation", narrativeRole: "drives hallucinated or overly strict outcomes" },
      { version: 5, model: "gpt-4o-mini", summary: "Corrected policy interpretation", narrativeRole: "restores grounded refund behavior" },
    ],
  },
  {
    id: "prompt_escalation_triage",
    name: "escalation-triage",
    purpose: "Escalation and human-handoff decision prompt.",
    versions: [
      { version: 7, model: "gpt-4o", summary: "Baseline escalation logic", narrativeRole: "used in VIP and safety-sensitive scenarios" },
      { version: 8, model: "gpt-4o-mini", summary: "More sensitive escalation threshold", narrativeRole: "candidate for future safer rollout" },
    ],
  },
];

export const supportCopilotScenarios: DemoScenario[] = [
  {
    id: "scn_refund_after_window_baseline",
    title: "Refund after window baseline",
    issueType: "refund",
    customerTier: "self-serve",
    promptName: "support-reply",
    promptVersion: 17,
    narrativeRole: "baseline",
    expectedOutcome: "Grounded refusal with clear explanation.",
  },
  {
    id: "scn_refund_after_window_regression",
    title: "Refund after window regression",
    issueType: "refund",
    customerTier: "self-serve",
    promptName: "support-reply",
    promptVersion: 18,
    narrativeRole: "regression",
    expectedOutcome: "Cheaper and faster, but incorrectly handles refund nuance.",
  },
  {
    id: "scn_refund_after_window_fix",
    title: "Refund after window fix",
    issueType: "refund",
    customerTier: "self-serve",
    promptName: "support-reply",
    promptVersion: 19,
    narrativeRole: "fix",
    expectedOutcome: "Restores correctness with acceptable cost increase.",
  },
  {
    id: "scn_damaged_item_hallucination",
    title: "Damaged item hallucination",
    issueType: "refund",
    customerTier: "self-serve",
    promptName: "refund-policy-check",
    promptVersion: 4,
    narrativeRole: "hallucination regression",
    expectedOutcome: "Should request clarification or escalate instead of inventing policy.",
  },
  {
    id: "scn_vip_chargeback_missed_escalation",
    title: "VIP chargeback missed escalation",
    issueType: "billing",
    customerTier: "premium",
    promptName: "support-reply",
    promptVersion: 18,
    narrativeRole: "escalation regression",
    expectedOutcome: "Should escalate immediately for chargeback risk.",
  },
  {
    id: "scn_vip_chargeback_restored_escalation",
    title: "VIP chargeback restored escalation",
    issueType: "billing",
    customerTier: "premium",
    promptName: "support-reply",
    promptVersion: 19,
    narrativeRole: "escalation fix",
    expectedOutcome: "Restores correct human escalation behavior.",
  },
  {
    id: "scn_kb_timeout_failed",
    title: "Knowledge-base timeout failure",
    issueType: "shipping",
    customerTier: "self-serve",
    promptName: "support-reply",
    promptVersion: 18,
    narrativeRole: "infra failure",
    expectedOutcome: "Timeout degrades answer quality and raises latency.",
  },
  {
    id: "scn_kb_timeout_recovered",
    title: "Knowledge-base timeout recovery",
    issueType: "shipping",
    customerTier: "self-serve",
    promptName: "support-reply",
    promptVersion: 19,
    narrativeRole: "recovery",
    expectedOutcome: "Fallback path recovers a usable answer with lower risk.",
  },
];

export const supportCopilotCuratedTraces: DemoCuratedTrace[] = [
  {
    id: "trace_support_refund_v17_baseline",
    scenarioId: "scn_refund_after_window_baseline",
    status: "healthy",
    replayPriority: "medium",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_support_refund_v17_baseline",
      agentId: "refund-policy-agent",
      promptName: "support-reply",
      promptVersion: 17,
      issueType: "refund",
      customerTier: "self-serve",
      releaseVersion: "2026.04.10",
      totalCost: 0.0831,
      durationMs: 11800,
      escalationRequired: false,
      policyResult: "correct_refusal",
      qualityScore: 0.93,
    }),
  },
  {
    id: "trace_support_refund_v18_regression",
    scenarioId: "scn_refund_after_window_regression",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_support_refund_v18_regression",
      agentId: "refund-policy-agent",
      promptName: "support-reply",
      promptVersion: 18,
      issueType: "refund",
      customerTier: "self-serve",
      releaseVersion: "2026.04.12",
      totalCost: 0.0418,
      durationMs: 9800,
      escalationRequired: true,
      policyResult: "incorrect_denial",
      llmFailure: true,
      qualityScore: 0.48,
    }),
  },
  {
    id: "trace_support_refund_v19_fix",
    scenarioId: "scn_refund_after_window_fix",
    status: "healthy",
    replayPriority: "medium",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_support_refund_v19_fix",
      agentId: "refund-policy-agent",
      promptName: "support-reply",
      promptVersion: 19,
      issueType: "refund",
      customerTier: "self-serve",
      releaseVersion: "2026.04.13",
      totalCost: 0.0446,
      durationMs: 10200,
      escalationRequired: false,
      policyResult: "correct_refusal",
      qualityScore: 0.91,
    }),
  },
  {
    id: "trace_damage_receipt_v18_hallucination",
    scenarioId: "scn_damaged_item_hallucination",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_damage_receipt_v18_hallucination",
      agentId: "refund-policy-agent",
      promptName: "refund-policy-check",
      promptVersion: 4,
      issueType: "refund",
      customerTier: "self-serve",
      releaseVersion: "2026.04.12",
      totalCost: 0.0522,
      durationMs: 10900,
      escalationRequired: true,
      policyResult: "hallucinated_policy_denial",
      llmFailure: true,
      qualityScore: 0.39,
      sessionSuffix: "damage_hallucination",
    }),
  },
  {
    id: "trace_vip_chargeback_v18_missed_escalation",
    scenarioId: "scn_vip_chargeback_missed_escalation",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_vip_chargeback_v18_missed_escalation",
      agentId: "escalation-agent",
      promptName: "support-reply",
      promptVersion: 18,
      issueType: "billing",
      customerTier: "premium",
      releaseVersion: "2026.04.12",
      totalCost: 0.0364,
      durationMs: 8700,
      escalationRequired: true,
      policyResult: "missed_escalation",
      llmFailure: true,
      qualityScore: 0.41,
      sessionSuffix: "vip_chargeback",
    }),
  },
  {
    id: "trace_vip_chargeback_v19_restored_escalation",
    scenarioId: "scn_vip_chargeback_restored_escalation",
    status: "healthy",
    replayPriority: "medium",
    diffPriority: "high",
    trace: makeSupportTrace({
      id: "trace_vip_chargeback_v19_restored_escalation",
      agentId: "escalation-agent",
      promptName: "support-reply",
      promptVersion: 19,
      issueType: "billing",
      customerTier: "premium",
      releaseVersion: "2026.04.13",
      totalCost: 0.0391,
      durationMs: 9100,
      escalationRequired: true,
      policyResult: "correct_escalation",
      qualityScore: 0.94,
      sessionSuffix: "vip_chargeback",
    }),
  },
  {
    id: "trace_kb_timeout_failed",
    scenarioId: "scn_kb_timeout_failed",
    status: "error",
    replayPriority: "high",
    diffPriority: "medium",
    trace: makeSupportTrace({
      id: "trace_kb_timeout_failed",
      agentId: "support-rag-agent",
      promptName: "support-reply",
      promptVersion: 18,
      issueType: "shipping",
      customerTier: "self-serve",
      releaseVersion: "2026.04.12",
      totalCost: 0.0629,
      durationMs: 14600,
      escalationRequired: false,
      policyResult: "degraded_answer_after_timeout",
      kbTimeout: true,
      qualityScore: 0.52,
      sessionSuffix: "kb_timeout",
    }),
  },
  {
    id: "trace_kb_timeout_recovered",
    scenarioId: "scn_kb_timeout_recovered",
    status: "healthy",
    replayPriority: "high",
    diffPriority: "medium",
    trace: makeSupportTrace({
      id: "trace_kb_timeout_recovered",
      agentId: "support-rag-agent",
      promptName: "support-reply",
      promptVersion: 19,
      issueType: "shipping",
      customerTier: "self-serve",
      releaseVersion: "2026.04.13",
      totalCost: 0.0574,
      durationMs: 11200,
      escalationRequired: false,
      policyResult: "recovered_after_fallback",
      qualityScore: 0.88,
      sessionSuffix: "kb_timeout",
    }),
  },
];

export const supportCopilotBackgroundTraces: Trace[] = [
  makeSupportTrace({
    id: "trace_bg_shipping_status_001",
    agentId: "support-rag-agent",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.13",
    totalCost: 0.0184,
    durationMs: 6400,
    escalationRequired: false,
    policyResult: "healthy_shipping_answer",
    qualityScore: 0.95,
    sessionSuffix: "bg_shipping_001",
  }),
  makeSupportTrace({
    id: "trace_bg_account_help_001",
    agentId: "support-rag-agent",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "account",
    customerTier: "self-serve",
    releaseVersion: "2026.04.13",
    totalCost: 0.0141,
    durationMs: 5200,
    escalationRequired: false,
    policyResult: "healthy_account_answer",
    qualityScore: 0.96,
    sessionSuffix: "bg_account_001",
  }),
  makeSupportTrace({
    id: "trace_bg_password_reset_001",
    agentId: "support-router",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "account",
    customerTier: "self-serve",
    releaseVersion: "2026.04.13",
    totalCost: 0.0092,
    durationMs: 3600,
    escalationRequired: false,
    policyResult: "healthy_router_path",
    qualityScore: 0.97,
    sessionSuffix: "bg_reset_001",
  }),
  makeSupportTrace({
    id: "trace_bg_shipping_delay_001",
    agentId: "support-rag-agent",
    promptName: "support-reply",
    promptVersion: 18,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.12",
    totalCost: 0.0218,
    durationMs: 7100,
    escalationRequired: false,
    policyResult: "healthy_shipping_delay_answer",
    qualityScore: 0.89,
    sessionSuffix: "bg_shipping_002",
  }),
  makeSupportTrace({
    id: "trace_bg_billing_question_001",
    agentId: "support-rag-agent",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "billing",
    customerTier: "premium",
    releaseVersion: "2026.04.13",
    totalCost: 0.0247,
    durationMs: 6800,
    escalationRequired: false,
    policyResult: "healthy_billing_answer",
    qualityScore: 0.92,
    sessionSuffix: "bg_billing_001",
  }),
  makeSupportTrace({
    id: "trace_bg_safety_handoff_001",
    agentId: "escalation-agent",
    promptName: "escalation-triage",
    promptVersion: 8,
    issueType: "safety",
    customerTier: "enterprise",
    releaseVersion: "2026.04.13",
    totalCost: 0.0312,
    durationMs: 5900,
    escalationRequired: true,
    policyResult: "correct_escalation",
    qualityScore: 0.98,
    sessionSuffix: "bg_safety_001",
  }),
];

export const supportCopilotDiffPairs: DemoDiffPair[] = [
  {
    id: "pair_hero_refund_regression",
    title: "Hero refund regression",
    baselineTraceId: "trace_support_refund_v17_baseline",
    comparisonTraceId: "trace_support_refund_v18_regression",
    narrative: "Version 18 is cheaper and faster, but mishandles the refund decision.",
  },
  {
    id: "pair_refund_fix_recovery",
    title: "Refund fix recovery",
    baselineTraceId: "trace_support_refund_v18_regression",
    comparisonTraceId: "trace_support_refund_v19_fix",
    narrative: "Version 19 restores policy correctness with a modest cost increase.",
  },
  {
    id: "pair_hallucination_regression",
    title: "Damaged-item hallucination regression",
    baselineTraceId: "trace_support_refund_v17_baseline",
    comparisonTraceId: "trace_damage_receipt_v18_hallucination",
    narrative: "A stricter refund-policy path produced a hallucinated unsupported denial.",
  },
  {
    id: "pair_escalation_recovery",
    title: "VIP chargeback escalation recovery",
    baselineTraceId: "trace_vip_chargeback_v18_missed_escalation",
    comparisonTraceId: "trace_vip_chargeback_v19_restored_escalation",
    narrative: "Version 19 restores the correct escalation behavior for premium billing risk.",
  },
  {
    id: "pair_timeout_recovery",
    title: "Knowledge-base timeout recovery",
    baselineTraceId: "trace_kb_timeout_failed",
    comparisonTraceId: "trace_kb_timeout_recovered",
    narrative: "Fallback handling reduces latency and improves answer quality after KB instability.",
  },
];

export const supportCopilotRegressions: DemoRegression[] = [
  {
    id: "reg_refund_denials_increased_after_v18",
    title: "Refund denials increased after support-reply v18",
    severity: "critical",
    traceId: "trace_support_refund_v18_regression",
    diffPairId: "pair_hero_refund_regression",
    promptName: "support-reply",
    summary: "Refund-policy-agent became cheaper but less correct immediately after the v18 rollout.",
  },
  {
    id: "reg_damaged_item_policy_hallucination",
    title: "Damaged-item flow hallucinated unsupported policy text",
    severity: "critical",
    traceId: "trace_damage_receipt_v18_hallucination",
    diffPairId: "pair_hallucination_regression",
    promptName: "refund-policy-check",
    summary: "The stricter refund-policy path invented a denial instead of asking for clarification or escalating.",
  },
  {
    id: "reg_premium_chargeback_missed_escalation",
    title: "Premium chargeback cases missed escalation",
    severity: "warning",
    traceId: "trace_vip_chargeback_v18_missed_escalation",
    diffPairId: "pair_escalation_recovery",
    promptName: "support-reply",
    summary: "A high-risk billing path answered directly instead of escalating quickly enough.",
  },
  {
    id: "reg_kb_timeout_spike",
    title: "Knowledge-base timeouts raised degraded-response rate",
    severity: "warning",
    traceId: "trace_kb_timeout_failed",
    diffPairId: "pair_timeout_recovery",
    summary: "Infrastructure instability added latency and reduced answer quality in common support flows.",
  },
  {
    id: "reg_refund_fix_validated",
    title: "Refund fix validated in v19 recovery run",
    severity: "healthy",
    traceId: "trace_support_refund_v19_fix",
    diffPairId: "pair_refund_fix_recovery",
    promptName: "support-reply",
    summary: "The v19 recovery path is currently the strongest promotion candidate for refund handling.",
  },
];

export const supportCopilotDatasets: DemoDataset[] = [
  {
    id: "dataset_refund_edge_cases",
    name: "refund-edge-cases",
    description: "Trace-derived refund edge cases used to validate fixes before promotion.",
    itemCount: 24,
    sourceTraceIds: [
      "trace_support_refund_v17_baseline",
      "trace_support_refund_v18_regression",
      "trace_support_refund_v19_fix",
      "trace_damage_receipt_v18_hallucination",
    ],
  },
  {
    id: "dataset_escalation_policy_cases",
    name: "escalation-policy-cases",
    description: "Premium and risk-sensitive support cases used to validate human-handoff behavior.",
    itemCount: 16,
    sourceTraceIds: [
      "trace_vip_chargeback_v18_missed_escalation",
      "trace_vip_chargeback_v19_restored_escalation",
    ],
  },
  {
    id: "dataset_support_hallucination_guardrails",
    name: "support-hallucination-guardrails",
    description: "Cases derived from unsupported claims and policy-grounding failures.",
    itemCount: 12,
    sourceTraceIds: [
      "trace_damage_receipt_v18_hallucination",
      "trace_support_refund_v18_regression",
    ],
  },
  {
    id: "dataset_latency_sensitive_common_questions",
    name: "latency-sensitive-common-questions",
    description: "Fast-path support questions used for cost and latency optimization without sacrificing answer quality.",
    itemCount: 20,
    sourceTraceIds: [
      "trace_kb_timeout_failed",
      "trace_kb_timeout_recovered",
    ],
  },
];

export const supportCopilotEvaluators: DemoEvaluator[] = [
  {
    id: "eval_refund_policy_correctness",
    name: "refund_policy_correctness",
    scoringType: "categorical",
    model: "gpt-4o",
    health: "critical",
    summary: "Flags v18 refund traces as incorrect during the regression window.",
  },
  {
    id: "eval_escalation_correctness",
    name: "escalation_correctness",
    scoringType: "categorical",
    model: "gpt-4o-mini",
    health: "warning",
    summary: "Tracks whether premium-risk and sensitive cases are escalated correctly.",
  },
  {
    id: "eval_policy_groundedness",
    name: "policy_groundedness",
    scoringType: "numeric",
    model: "gpt-4o",
    health: "healthy",
    summary: "Measures whether outputs remain grounded in supported policy material.",
  },
  {
    id: "eval_helpfulness",
    name: "helpfulness",
    scoringType: "numeric",
    model: "gpt-4o",
    health: "healthy",
    summary: "Provides a top-line quality signal across support interactions.",
  },
];

export const supportCopilotExperiments: DemoExperiment[] = [
  {
    id: "exp_refund_recovery_v19",
    name: "refund-recovery-v19",
    datasetId: "dataset_refund_edge_cases",
    status: "completed",
    summary: "Version 19 restores correctness with acceptable cost increase.",
    winningCandidate: "support-reply v19",
  },
  {
    id: "exp_escalation_threshold_tuning",
    name: "escalation-threshold-tuning",
    datasetId: "dataset_escalation_policy_cases",
    status: "running",
    summary: "Still tuning the tradeoff between over-escalation and missed escalation in premium support cases.",
  },
  {
    id: "exp_cheap_common_support_routing",
    name: "cheap-common-support-routing",
    datasetId: "dataset_latency_sensitive_common_questions",
    status: "completed",
    summary: "Lower-cost routing preserved quality on common questions after fallback improvements.",
    winningCandidate: "support-reply v19 fast path",
  },
];

export const supportCopilotBudgets: DemoBudgetFixture[] = [
  {
    agentId: "refund-policy-agent",
    budgetUsd: 900,
    currentSpendUsd: 1062,
    status: "critical",
    summary: "Retries and poor routing inflated refund-policy-agent costs beyond budget.",
  },
  {
    agentId: "support-rag-agent",
    budgetUsd: 2500,
    currentSpendUsd: 2284,
    status: "warning",
    summary: "Knowledge-base instability and fallback logic pushed the main support flow close to budget limits.",
  },
  {
    agentId: "support-router",
    budgetUsd: 300,
    currentSpendUsd: 126,
    status: "healthy",
    summary: "Intent classification remains cheap and stable.",
  },
];

export const supportCopilotSlas: DemoSlaFixture[] = [
  {
    agentId: "refund-policy-agent",
    maxDurationMs: 8000,
    minSuccessRate: 0.97,
    observedDurationMs: 9600,
    observedSuccessRate: 0.918,
    status: "critical",
    summary: "Refund-policy-agent breached both latency and success-rate expectations during the regression window.",
  },
  {
    agentId: "support-rag-agent",
    maxDurationMs: 12000,
    minSuccessRate: 0.96,
    observedDurationMs: 11400,
    observedSuccessRate: 0.952,
    status: "warning",
    summary: "Common support flows remain near SLA limits while recovery logic is still settling.",
  },
  {
    agentId: "escalation-agent",
    maxDurationMs: 5000,
    minSuccessRate: 0.99,
    observedDurationMs: 4300,
    observedSuccessRate: 0.987,
    status: "warning",
    summary: "Escalation logic improved, but premium-risk cases are still under close review.",
  },
];

export const supportCopilotNotifications: DemoNotificationFixture[] = [
  {
    channelId: "channel_platform_ops",
    channelName: "#platform-ops",
    kind: "slack",
    status: "warning",
    summary: "Critical refund-policy alerts route here, with one recent failed delivery worth review.",
  },
  {
    channelId: "channel_support_ai_alerts",
    channelName: "#support-ai-alerts",
    kind: "slack",
    status: "healthy",
    summary: "Behavior regressions and replay-worthy investigation alerts surface here for the support team.",
  },
  {
    channelId: "channel_exec_digest",
    channelName: "#exec-digest",
    kind: "slack",
    status: "healthy",
    summary: "Executive-level budget and promotion summaries are routed here after major experiment updates.",
  },
];

export const supportCopilotReplayTargetTraceIds = [
  "trace_support_refund_v18_regression",
  "trace_support_refund_v19_fix",
  "trace_damage_receipt_v18_hallucination",
  "trace_vip_chargeback_v18_missed_escalation",
  "trace_kb_timeout_failed",
  "trace_kb_timeout_recovered",
];

export function buildMarketingHeroDemo(): MarketingHeroDemo {
  const backgroundTraces = supportCopilotBackgroundTraces;
  const allTraces = [...supportCopilotCuratedTraces.map((item) => item.trace), ...backgroundTraces];

  return {
    org: demoOrgs[0]!,
    prompts: supportCopilotPrompts,
    scenarios: supportCopilotScenarios,
    curatedTraces: supportCopilotCuratedTraces,
    backgroundTraces,
    allTraces,
    diffPairs: supportCopilotDiffPairs,
    regressions: supportCopilotRegressions,
    datasets: supportCopilotDatasets,
    evaluators: supportCopilotEvaluators,
    experiments: supportCopilotExperiments,
    budgets: supportCopilotBudgets,
    slas: supportCopilotSlas,
    notifications: supportCopilotNotifications,
  };
}

export function buildLocalReviewDemo(): LocalReviewDemo {
  const hero = buildMarketingHeroDemo();

  return {
    ...hero,
    replayTargetTraceIds: supportCopilotReplayTargetTraceIds,
    overviewMetrics: [
      {
        label: "Monitored agents",
        value: "14",
        supportingText: "Support Copilot is the hero tenant in a broader monitored fleet.",
      },
      {
        label: "Runs in last 24h",
        value: "3,842",
        supportingText: "Enough activity to make investigation and trend views feel realistic.",
      },
      {
        label: "Regressions needing review",
        value: "3",
        supportingText: "Refund behavior remains the highest-priority issue, with escalation and KB reliability close behind.",
      },
      {
        label: "Budget risk agents",
        value: "2",
        supportingText: "Refund-policy-agent and support-rag-agent are the main spend hotspots in the current story.",
      },
    ],
    executiveMetrics: [
      {
        label: "Fleet reliability",
        value: "96.8%",
        supportingText: "Reliability dipped after the support-reply v18 rollout and remains under targeted recovery review.",
      },
      {
        label: "Budget exposure",
        value: "$1.3k at risk",
        supportingText: "Overspend is concentrated in refund-related workflows and support-rag recovery behavior.",
      },
      {
        label: "Open regressions",
        value: "3",
        supportingText: "Refund handling, escalation quality, and KB timeout behavior are the main active investigation threads.",
      },
      {
        label: "Promotion candidates",
        value: "1",
        supportingText: "support-reply v19 is the current strongest promotion candidate.",
      },
    ],
  };
}
