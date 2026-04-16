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

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/**
 * Anchor the demo week to 7 days before the current moment so sandbox
 * data always looks recent. Snapped to 14:00 UTC on that day.
 */
const DEMO_WEEK_START_MS = (() => {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;
  // Snap to 14:00 UTC on that day
  const d = new Date(sevenDaysAgo);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14, 0, 0);
})();

function atDemoTime(dayOffset: number, hour: number, minute: number): number {
  return DEMO_WEEK_START_MS + (dayOffset * DAY_MS) + (hour * HOUR_MS) + (minute * MINUTE_MS);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function makeSpanEvent(
  timeMs: number,
  name: string,
  attributes: Record<string, string | number | boolean | null>,
) {
  return { timeMs, name, attributes };
}

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
  events: Span["events"] = [],
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
    events,
  };
}

type AgentKey =
  | "returns_copilot"
  | "premium_escalation"
  | "shipping_resolution"
  | "billing_guard"
  | "account_recovery"
  | "policy_grounding"
  | "fraud_watch"
  | "voice_of_customer";

interface AgentProfile {
  key: AgentKey;
  id: string;
  displayName: string;
  team: string;
  mission: string;
  workflow: string;
  owner: string;
  primaryPrompt: string;
  primaryPromptId: string;
}

const agentProfiles: Record<AgentKey, AgentProfile> = {
  returns_copilot: {
    key: "returns_copilot",
    id: "returns-resolution-copilot",
    displayName: "Returns Resolution Copilot",
    team: "Post-purchase Ops",
    mission: "Handles refund, exchange, and return-eligibility decisions for self-serve customers.",
    workflow: "refund_and_return_resolution",
    owner: "Support automation",
    primaryPrompt: "support-reply",
    primaryPromptId: "prompt_support_reply",
  },
  premium_escalation: {
    key: "premium_escalation",
    id: "premium-escalation-triage",
    displayName: "Premium Escalation Triage",
    team: "VIP Support",
    mission: "Escalates revenue-risk, safety-sensitive, and executive-facing support cases.",
    workflow: "premium_escalation_triage",
    owner: "Escalations desk",
    primaryPrompt: "escalation-triage",
    primaryPromptId: "prompt_escalation_triage",
  },
  shipping_resolution: {
    key: "shipping_resolution",
    id: "shipping-delay-resolution",
    displayName: "Shipping Delay Resolution",
    team: "Logistics Support",
    mission: "Explains delivery delays, damaged shipments, and replacement paths using logistics knowledge.",
    workflow: "shipping_resolution",
    owner: "Logistics ops",
    primaryPrompt: "shipping-delay-triage",
    primaryPromptId: "prompt_shipping_delay_triage",
  },
  billing_guard: {
    key: "billing_guard",
    id: "billing-operations-guard",
    displayName: "Billing Operations Guard",
    team: "Revenue Ops",
    mission: "Resolves duplicate charges, chargeback risk, and subscription disputes.",
    workflow: "billing_dispute_resolution",
    owner: "Revenue automation",
    primaryPrompt: "billing-dispute-investigator",
    primaryPromptId: "prompt_billing_dispute_investigator",
  },
  account_recovery: {
    key: "account_recovery",
    id: "account-recovery-assistant",
    displayName: "Account Recovery Assistant",
    team: "Account Security",
    mission: "Guides login recovery, account lockouts, and identity verification support paths.",
    workflow: "account_recovery",
    owner: "Identity operations",
    primaryPrompt: "account-recovery-guide",
    primaryPromptId: "prompt_account_recovery_guide",
  },
  policy_grounding: {
    key: "policy_grounding",
    id: "policy-grounding-reviewer",
    displayName: "Policy Grounding Reviewer",
    team: "Trust and Safety",
    mission: "Checks whether policy-heavy responses remain grounded in approved support rules.",
    workflow: "policy_grounding_review",
    owner: "Policy quality",
    primaryPrompt: "refund-policy-check",
    primaryPromptId: "prompt_refund_policy_check",
  },
  fraud_watch: {
    key: "fraud_watch",
    id: "fraud-watch-investigator",
    displayName: "Fraud Watch Investigator",
    team: "Risk Operations",
    mission: "Flags abuse patterns, suspicious refund loops, and payout manipulation.",
    workflow: "fraud_review",
    owner: "Risk automation",
    primaryPrompt: "fraud-risk-review",
    primaryPromptId: "prompt_fraud_risk_review",
  },
  voice_of_customer: {
    key: "voice_of_customer",
    id: "voice-of-customer-summarizer",
    displayName: "Voice of Customer Summarizer",
    team: "Support Insights",
    mission: "Clusters support themes and writes executive-ready incident summaries.",
    workflow: "support_theme_summarization",
    owner: "CX analytics",
    primaryPrompt: "weekly-support-brief",
    primaryPromptId: "prompt_weekly_support_brief",
  },
};

export const demoOrgs: DemoOrg[] = [
  {
    id: "org_support_copilot",
    name: "Support Copilot",
    slug: "support-copilot",
    plan: "team",
    llmEvaluationEnabled: true,
    role: "primary",
    description: "Hero demo org for support observability, regressions, experiments, and governance workflows.",
  },
];

export const supportCopilotPrompts: DemoPrompt[] = [
  {
    id: "prompt_support_reply",
    name: "support-reply",
    purpose: "Primary customer-facing support response prompt for refunds, exchanges, and general issue resolution.",
    versions: [
      { version: 17, model: "gpt-4o", summary: "Stable baseline with careful refund nuance", narrativeRole: "last known good before the rollout" },
      { version: 18, model: "gpt-4o-mini", summary: "Compressed low-cost rollout with refund regressions", narrativeRole: "cheaper and faster, but less reliable on edge cases" },
      { version: 19, model: "gpt-4o-mini", summary: "Recovery candidate with restored policy grounding", narrativeRole: "current best candidate for promotion" },
    ],
  },
  {
    id: "prompt_refund_policy_check",
    name: "refund-policy-check",
    purpose: "Structured policy interpretation prompt for refund eligibility, clarification, and exception paths.",
    versions: [
      { version: 3, model: "gpt-4o", summary: "Stable policy grounding baseline", narrativeRole: "reference policy behavior" },
      { version: 4, model: "gpt-4o-mini", summary: "Overly strict policy branch with hallucinated denials", narrativeRole: "source of the policy hallucination story" },
      { version: 5, model: "gpt-4o-mini", summary: "Corrected policy grounding with safer escalation fallback", narrativeRole: "restores grounded policy behavior" },
    ],
  },
  {
    id: "prompt_escalation_triage",
    name: "escalation-triage",
    purpose: "Determines whether a support case should be handed to a premium human queue.",
    versions: [
      { version: 7, model: "gpt-4o", summary: "Baseline escalation logic", narrativeRole: "reference escalation behavior" },
      { version: 8, model: "gpt-4o-mini", summary: "Safer escalation sensitivity tuning", narrativeRole: "candidate under evaluation" },
    ],
  },
  {
    id: "prompt_shipping_delay_triage",
    name: "shipping-delay-triage",
    purpose: "Handles delay attribution, damaged shipment decisions, and replacement recommendations.",
    versions: [
      { version: 6, model: "gpt-4o", summary: "Stable logistics baseline", narrativeRole: "healthy resolution path" },
      { version: 7, model: "gpt-4o-mini", summary: "Faster path with timeout fallback adjustments", narrativeRole: "active optimization path" },
    ],
  },
  {
    id: "prompt_billing_dispute_investigator",
    name: "billing-dispute-investigator",
    purpose: "Investigates duplicate charges, chargebacks, and subscription-billing disputes.",
    versions: [
      { version: 10, model: "gpt-4o", summary: "Reference billing dispute handling", narrativeRole: "baseline billing accuracy" },
      { version: 11, model: "gpt-4o-mini", summary: "Lean billing investigation path", narrativeRole: "cost-optimized billing path" },
    ],
  },
  {
    id: "prompt_account_recovery_guide",
    name: "account-recovery-guide",
    purpose: "Guides customers through account lockout, identity checks, and recovery next steps.",
    versions: [
      { version: 5, model: "gpt-4o-mini", summary: "Current lockout-recovery workflow", narrativeRole: "stable fast-path prompt" },
    ],
  },
  {
    id: "prompt_fraud_risk_review",
    name: "fraud-risk-review",
    purpose: "Reviews refund, payout, and order behavior for abuse patterns and fraud indicators.",
    versions: [
      { version: 2, model: "gpt-4o", summary: "Risk-review baseline", narrativeRole: "healthy watchdog prompt" },
    ],
  },
  {
    id: "prompt_weekly_support_brief",
    name: "weekly-support-brief",
    purpose: "Summarizes support incidents, trend shifts, and operator actions for weekly reviews.",
    versions: [
      { version: 4, model: "gpt-4o-mini", summary: "Current insights summarization template", narrativeRole: "executive recap path" },
    ],
  },
];

interface ScenarioSeed {
  id: string;
  title: string;
  issueType: string;
  customerTier: string;
  narrativeRole: string;
  expectedOutcome: string;
  profile: AgentKey;
  promptName: string;
  promptVersion: number;
  hero?: boolean;
}

const scenarioSeeds: ScenarioSeed[] = [
  {
    id: "scn_refund_after_window_baseline",
    title: "Late refund request handled with grounded refusal",
    issueType: "refund",
    customerTier: "self-serve",
    narrativeRole: "baseline",
    expectedOutcome: "Explain the policy boundary clearly and offer alternative recovery options.",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 17,
    hero: true,
  },
  {
    id: "scn_refund_after_window_regression",
    title: "Compressed refund rollout denied a valid exception path",
    issueType: "refund",
    customerTier: "self-serve",
    narrativeRole: "regression",
    expectedOutcome: "Regression should surface as faster and cheaper, but incorrect on edge-case reasoning.",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 18,
    hero: true,
  },
  {
    id: "scn_refund_after_window_fix",
    title: "Recovery candidate restored refund quality",
    issueType: "refund",
    customerTier: "self-serve",
    narrativeRole: "fix",
    expectedOutcome: "Restores grounded handling with a modest cost increase.",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 19,
    hero: true,
  },
  {
    id: "scn_damaged_item_hallucination",
    title: "Damaged-item policy path hallucinated a denial",
    issueType: "refund",
    customerTier: "self-serve",
    narrativeRole: "hallucination regression",
    expectedOutcome: "Should ask for clarification or escalate instead of inventing policy text.",
    profile: "policy_grounding",
    promptName: "refund-policy-check",
    promptVersion: 4,
    hero: true,
  },
  {
    id: "scn_vip_chargeback_missed_escalation",
    title: "Premium chargeback case missed escalation",
    issueType: "billing",
    customerTier: "premium",
    narrativeRole: "escalation regression",
    expectedOutcome: "Should hand off immediately to the premium queue.",
    profile: "premium_escalation",
    promptName: "support-reply",
    promptVersion: 18,
    hero: true,
  },
  {
    id: "scn_vip_chargeback_restored_escalation",
    title: "Premium chargeback recovery restored escalation",
    issueType: "billing",
    customerTier: "premium",
    narrativeRole: "escalation fix",
    expectedOutcome: "Returns the correct human-handoff behavior.",
    profile: "premium_escalation",
    promptName: "support-reply",
    promptVersion: 19,
    hero: true,
  },
  {
    id: "scn_kb_timeout_failed",
    title: "Logistics lookup timeout caused degraded shipping response",
    issueType: "shipping",
    customerTier: "self-serve",
    narrativeRole: "infra failure",
    expectedOutcome: "Timeout should raise latency and reduce answer quality.",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 7,
    hero: true,
  },
  {
    id: "scn_kb_timeout_recovered",
    title: "Fallback shipping path recovered from lookup timeout",
    issueType: "shipping",
    customerTier: "self-serve",
    narrativeRole: "recovery",
    expectedOutcome: "Fallback path should reduce risk and restore quality.",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 7,
    hero: true,
  },
  {
    id: "scn_duplicate_charge_investigation",
    title: "Duplicate-charge investigation routed cleanly",
    issueType: "billing",
    customerTier: "premium",
    narrativeRole: "healthy billing path",
    expectedOutcome: "Resolve a duplicate charge without escalation or policy drift.",
    profile: "billing_guard",
    promptName: "billing-dispute-investigator",
    promptVersion: 11,
  },
  {
    id: "scn_account_lockout_recovery",
    title: "Account lockout recovery stayed on the fast path",
    issueType: "account",
    customerTier: "self-serve",
    narrativeRole: "healthy account recovery",
    expectedOutcome: "Guide identity recovery quickly and safely.",
    profile: "account_recovery",
    promptName: "account-recovery-guide",
    promptVersion: 5,
  },
  {
    id: "scn_refund_abuse_pattern_review",
    title: "Refund abuse pattern escalated to fraud review",
    issueType: "fraud",
    customerTier: "self-serve",
    narrativeRole: "fraud escalation",
    expectedOutcome: "Flag coordinated refund misuse for manual review.",
    profile: "fraud_watch",
    promptName: "fraud-risk-review",
    promptVersion: 2,
  },
  {
    id: "scn_weekly_support_incident_summary",
    title: "Weekly support brief summarized operational drift",
    issueType: "reporting",
    customerTier: "internal",
    narrativeRole: "insights summary",
    expectedOutcome: "Create an operator-friendly summary with trend deltas and actions.",
    profile: "voice_of_customer",
    promptName: "weekly-support-brief",
    promptVersion: 4,
  },
];

export const supportCopilotScenarios: DemoScenario[] = scenarioSeeds.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  issueType: scenario.issueType,
  customerTier: scenario.customerTier,
  promptName: scenario.promptName,
  promptVersion: scenario.promptVersion,
  narrativeRole: scenario.narrativeRole,
  expectedOutcome: scenario.expectedOutcome,
}));

interface TraceBuildParams {
  id: string;
  scenarioId: string;
  profile: AgentProfile;
  promptName: string;
  promptVersion: number;
  issueType: string;
  customerTier: string;
  releaseVersion: string;
  totalCost: number;
  durationMs: number;
  escalationRequired: boolean;
  policyResult: string;
  storyLabel: string;
  storySummary: string;
  customerIntent: string;
  expectedResolution: string;
  severityTag: "healthy" | "warning" | "critical";
  statusLabel: string;
  environment?: string;
  language?: string;
  userId?: string;
  startTimeMs: number;
  sessionId: string;
  modelProvider?: string;
  modelName?: string;
  kbTimeout?: boolean;
  llmFailure?: boolean;
  qualityScore?: number;
  tokenScale?: number;
  extraContext?: Record<string, string | number | boolean | null>;
}

function buildNarrativeTranscript(params: TraceBuildParams): string {
  const lines = [
    `Case: ${params.storyLabel}`,
    `Intent: ${params.customerIntent}`,
    `Expected resolution: ${params.expectedResolution}`,
    `Observed policy result: ${params.policyResult}`,
    `Story summary: ${params.storySummary}`,
    `Agent role: ${params.profile.displayName}`,
    `Owner team: ${params.profile.team}`,
  ];

  return lines.join("\n");
}

function buildGeneratedStorySummary(
  profile: AgentProfile,
  template: BackgroundScenarioTemplate,
  dayOffset: number,
  index: number,
  qualityScore: number,
): string {
  const dayLabel = `day ${dayOffset + 1}`;
  const qualityLabel = qualityScore >= 0.9 ? 'strong quality' : qualityScore >= 0.8 ? 'stable quality' : qualityScore >= 0.7 ? 'mixed quality' : 'fragile quality';

  switch (template.id) {
    case 'shipping_status_refresh':
      return `${profile.displayName} explained a delayed shipment clearly on ${dayLabel}, keeping the customer on the self-serve path with ${qualityLabel}.`;
    case 'refund_clarification_needed':
      return `${profile.displayName} avoided an incorrect refund denial on ${dayLabel} by asking for the missing evidence before deciding.`;
    case 'duplicate_charge_review':
      return `${profile.displayName} separated a likely duplicate charge from standard renewal noise on ${dayLabel} and kept the billing case grounded.`;
    case 'account_lockout_fastpath':
      return `${profile.displayName} kept an account-recovery case secure and fast on ${dayLabel} without escalating the customer unnecessarily.`;
    case 'premium_contract_escalation':
      return `${profile.displayName} escalated an enterprise billing request with the right contract context on ${dayLabel}, preserving the premium support handoff.`;
    case 'fraud_pattern_review':
      return `${profile.displayName} flagged suspicious refund behavior on ${dayLabel} and routed the account cluster into manual risk review.`;
    case 'support_weekly_brief':
      return `${profile.displayName} produced an operator-ready weekly summary on ${dayLabel}, connecting incident drift, budget pressure, and next actions.`;
    case 'shipping_delay_warning':
      return `${profile.displayName} returned a usable but slower shipping answer on ${dayLabel} after carrier lookup latency started to climb.`;
    default:
      return `${profile.displayName} handled the ${template.issueType} workflow on ${dayLabel} with ${qualityLabel}.`;
  }
}

function makeSupportTrace(params: TraceBuildParams): Trace {
  const start = params.startTimeMs;
  const workflowDuration = params.durationMs;
  const hasError = Boolean(
    params.kbTimeout ||
      params.llmFailure ||
      params.policyResult.includes("incorrect") ||
      params.policyResult.includes("hallucinated") ||
      params.policyResult.includes("missed") ||
      params.policyResult.includes("degraded"),
  );
  const qualityScore = params.qualityScore ?? (hasError ? 0.46 : 0.93);
  const tokenScale = params.tokenScale ?? 1;
  const modelName = params.modelName ?? (params.promptVersion >= 18 ? "gpt-4o-mini" : "gpt-4o");
  const llmInputA = Math.round(420 * tokenScale);
  const llmOutputA = Math.round(56 * tokenScale);
  const llmInputB = Math.round(1260 * tokenScale);
  const llmOutputB = Math.round(240 * tokenScale);
  const llmInputC = Math.round(890 * tokenScale);
  const llmOutputC = Math.round(210 * tokenScale);
  const transcript = buildNarrativeTranscript(params);

  const spans: Span[] = [
    makeSpan(
      params.id,
      "workflow_1",
      `Resolve ${params.issueType} request`,
      "workflow",
      start,
      workflowDuration,
      hasError ? "error" : "ok",
      {
        workflow: params.profile.workflow,
        issue_type: params.issueType,
        story_label: params.storyLabel,
        scenario_id: params.scenarioId,
        severity_tag: params.severityTag,
        expected_resolution: params.expectedResolution,
      },
      undefined,
      [
        makeSpanEvent(start + 50, "case_loaded", {
          scenario_id: params.scenarioId,
          customer_tier: params.customerTier,
          issue_type: params.issueType,
        }),
        makeSpanEvent(start + workflowDuration - 120, "workflow_completed", {
          status_label: params.statusLabel,
          quality_score: Number(qualityScore.toFixed(2)),
        }),
      ],
    ),
    makeSpan(
      params.id,
      "llm_1",
      "Classify request and extract risk factors",
      "llm_call",
      start + 120,
      900,
      "ok",
      {
        model: modelName,
        provider: params.modelProvider ?? "openai",
        input_tokens: llmInputA,
        output_tokens: llmOutputA,
        cost: Number((params.totalCost * 0.14).toFixed(4)),
        request_summary: params.customerIntent,
        transcript_excerpt: transcript.slice(0, 240),
      },
      "workflow_1",
      [
        makeSpanEvent(start + 180, "classification_started", {
          policy_family: params.promptName,
          customer_tier: params.customerTier,
        }),
        makeSpanEvent(start + 900, "classification_finished", {
          severity_tag: params.severityTag,
          escalation_required: params.escalationRequired,
        }),
      ],
    ),
    makeSpan(
      params.id,
      "tool_1",
      "Retrieve customer and order context",
      "tool_call",
      start + 1150,
      620,
      "ok",
      {
        tool: "customer_profile_lookup",
        latency_ms: 620,
        result_count: 3,
        account_tier: params.customerTier,
        account_owner: params.profile.owner,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 1200, "lookup_query", {
          entity_type: "customer_order_context",
          issue_type: params.issueType,
        }),
      ],
    ),
    makeSpan(
      params.id,
      "tool_2",
      params.issueType === "shipping" ? "Query shipping knowledge and live status" : "Query policy knowledge base",
      "tool_call",
      start + 1820,
      params.kbTimeout ? 2400 : 1280,
      params.kbTimeout ? "error" : "ok",
      {
        tool: params.issueType === "shipping" ? "shipping_incident_lookup" : "policy_kb_search",
        latency_ms: params.kbTimeout ? 2400 : 1280,
        result_count: params.kbTimeout ? 0 : 5,
        timeout: params.kbTimeout ? true : null,
        knowledge_domain: params.issueType,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 1900, "knowledge_lookup_started", {
          prompt_name: params.promptName,
          prompt_version: params.promptVersion,
        }),
        makeSpanEvent(start + (params.kbTimeout ? 4000 : 3000), params.kbTimeout ? "knowledge_lookup_timed_out" : "knowledge_lookup_completed", {
          policy_result: params.policyResult,
          timeout: params.kbTimeout ? true : false,
        }),
      ],
    ),
    makeSpan(
      params.id,
      "llm_2",
      "Draft agent response",
      "llm_call",
      start + 4300,
      params.llmFailure ? 2400 : 1820,
      params.llmFailure ? "error" : "ok",
      {
        model: modelName,
        provider: params.modelProvider ?? "openai",
        input_tokens: llmInputB,
        output_tokens: llmOutputB,
        cost: Number((params.totalCost * 0.33).toFixed(4)),
        temperature: 0.2,
        draft_summary: params.storySummary,
        guardrail_expectation: params.expectedResolution,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 4420, "draft_started", {
          story_label: params.storyLabel,
          quality_target: hasError ? "recover" : "maintain",
        }),
        makeSpanEvent(start + 5980, params.llmFailure ? "draft_failed" : "draft_completed", {
          llm_failure: params.llmFailure ? true : false,
          quality_score: Number(qualityScore.toFixed(2)),
        }),
      ],
    ),
    makeSpan(
      params.id,
      "step_1",
      params.escalationRequired ? "Evaluate escalation and policy confidence" : "Validate policy decision",
      "agent_step",
      start + 6500,
      720,
      hasError ? "error" : "ok",
      {
        policy_result: params.policyResult,
        confidence: hasError ? 0.44 : 0.92,
        escalation_required: params.escalationRequired,
        status_label: params.statusLabel,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 6550, "policy_validation_started", {
          expected_resolution: params.expectedResolution,
        }),
        makeSpanEvent(start + 7180, "policy_validation_finished", {
          severity_tag: params.severityTag,
          escalation_required: params.escalationRequired,
        }),
      ],
    ),
    makeSpan(
      params.id,
      "step_2",
      "Prepare operator-visible summary",
      "agent_step",
      start + 7300,
      560,
      hasError && params.escalationRequired ? "error" : "ok",
      {
        story_summary: params.storySummary,
        operator_label: params.storyLabel,
        quality_score: Number(qualityScore.toFixed(2)),
        owner_team: params.profile.team,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 7320, "operator_summary_started", {
          owner_team: params.profile.team,
          workflow: params.profile.workflow,
        }),
        makeSpanEvent(start + 7820, "operator_summary_ready", {
          status_label: params.statusLabel,
        }),
      ],
    ),
    makeSpan(
      params.id,
      "llm_3",
      "Finalize response and action plan",
      "llm_call",
      start + 7960,
      Math.max(620, workflowDuration - 7960),
      hasError ? "error" : "ok",
      {
        model: modelName,
        provider: params.modelProvider ?? "openai",
        input_tokens: llmInputC,
        output_tokens: llmOutputC,
        cost: Number((params.totalCost * 0.53).toFixed(4)),
        temperature: 0.1,
        final_summary: params.storySummary,
        expected_resolution: params.expectedResolution,
      },
      "workflow_1",
      [
        makeSpanEvent(start + 8050, "finalization_started", {
          prompt_name: params.promptName,
          prompt_version: params.promptVersion,
        }),
        makeSpanEvent(start + workflowDuration - 40, hasError ? "finalization_degraded" : "finalization_completed", {
          quality_score: Number(qualityScore.toFixed(2)),
          cost_usd: Number(params.totalCost.toFixed(4)),
        }),
      ],
    ),
  ];

  return {
    id: params.id,
    agentId: params.profile.displayName,
    sessionId: params.sessionId,
    startTimeMs: start,
    endTimeMs: start + workflowDuration,
    spans,
    metadata: {
      workflow: params.profile.workflow,
      environment: params.environment ?? "production",
      issue_type: params.issueType,
      customer_tier: params.customerTier,
      prompt_name: params.promptName,
      prompt_version: params.promptVersion,
      release_version: params.releaseVersion,
      model_provider: params.modelProvider ?? "openai",
      model_name: modelName,
      ticket_id: `ticket_${slugify(params.storyLabel)}_${slugify(params.sessionId)}`,
      language: params.language ?? "en",
      user_id: params.userId ?? `customer_${slugify(params.issueType)}`,
      agent_profile_id: params.profile.id,
      agent_team: params.profile.team,
      agent_owner: params.profile.owner,
      agent_mission: params.profile.mission,
      story_label: params.storyLabel,
      story_summary: params.storySummary,
      scenario_id: params.scenarioId,
      customer_intent: params.customerIntent,
      expected_resolution: params.expectedResolution,
      policy_result: params.policyResult,
      quality_score: Number(qualityScore.toFixed(2)),
      severity_tag: params.severityTag,
      status_label: params.statusLabel,
      replay_label: `${params.profile.displayName} · ${params.storyLabel}`,
      operator_notes: transcript,
      ...params.extraContext,
    },
  };
}

function createCuratedTrace(input: {
  id: string;
  scenarioId: string;
  status: DemoCuratedTrace["status"];
  replayPriority: DemoCuratedTrace["replayPriority"];
  diffPriority: DemoCuratedTrace["diffPriority"];
  startTimeMs: number;
  sessionId: string;
  profile: AgentKey;
  promptName: string;
  promptVersion: number;
  issueType: string;
  customerTier: string;
  releaseVersion: string;
  totalCost: number;
  durationMs: number;
  escalationRequired: boolean;
  policyResult: string;
  storyLabel: string;
  storySummary: string;
  customerIntent: string;
  expectedResolution: string;
  severityTag: "healthy" | "warning" | "critical";
  statusLabel: string;
  kbTimeout?: boolean;
  llmFailure?: boolean;
  qualityScore?: number;
  tokenScale?: number;
  extraContext?: Record<string, string | number | boolean | null>;
}): DemoCuratedTrace {
  return {
    id: input.id,
    scenarioId: input.scenarioId,
    status: input.status,
    replayPriority: input.replayPriority,
    diffPriority: input.diffPriority,
    trace: makeSupportTrace({
      id: input.id,
      scenarioId: input.scenarioId,
      profile: agentProfiles[input.profile],
      promptName: input.promptName,
      promptVersion: input.promptVersion,
      issueType: input.issueType,
      customerTier: input.customerTier,
      releaseVersion: input.releaseVersion,
      totalCost: input.totalCost,
      durationMs: input.durationMs,
      escalationRequired: input.escalationRequired,
      policyResult: input.policyResult,
      storyLabel: input.storyLabel,
      storySummary: input.storySummary,
      customerIntent: input.customerIntent,
      expectedResolution: input.expectedResolution,
      severityTag: input.severityTag,
      statusLabel: input.statusLabel,
      startTimeMs: input.startTimeMs,
      sessionId: input.sessionId,
      kbTimeout: input.kbTimeout,
      llmFailure: input.llmFailure,
      qualityScore: input.qualityScore,
      tokenScale: input.tokenScale,
      extraContext: input.extraContext,
    }),
  };
}

export const supportCopilotCuratedTraces: DemoCuratedTrace[] = [
  createCuratedTrace({
    id: "trace_returns_exception_v17_baseline",
    scenarioId: "scn_refund_after_window_baseline",
    status: "healthy",
    replayPriority: "medium",
    diffPriority: "high",
    startTimeMs: atDemoTime(0, 10, 14),
    sessionId: "session_returns_exception_week1",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 17,
    issueType: "refund",
    customerTier: "self-serve",
    releaseVersion: "2026.04.07",
    totalCost: 0.0831,
    durationMs: 11800,
    escalationRequired: false,
    policyResult: "correct_refusal",
    storyLabel: "Late return request handled with clear exception guidance",
    storySummary: "Returns Resolution Copilot explained the refund window, suggested store credit, and stayed fully grounded.",
    customerIntent: "Customer requested a refund 42 days after delivery and referenced a damaged box photo.",
    expectedResolution: "Refuse the refund politely, cite the window, and offer the approved recovery path.",
    severityTag: "healthy",
    statusLabel: "Healthy baseline",
    qualityScore: 0.93,
    tokenScale: 1.02,
  }),
  createCuratedTrace({
    id: "trace_returns_exception_v18_regression",
    scenarioId: "scn_refund_after_window_regression",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    startTimeMs: atDemoTime(3, 9, 7),
    sessionId: "session_returns_exception_week1",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 18,
    issueType: "refund",
    customerTier: "self-serve",
    releaseVersion: "2026.04.10",
    totalCost: 0.0418,
    durationMs: 9800,
    escalationRequired: true,
    policyResult: "incorrect_denial",
    storyLabel: "Compressed refund rollout denied a valid exception path",
    storySummary: "The cheaper rollout responded faster, but missed the damaged-shipment exception and denied the case incorrectly.",
    customerIntent: "Customer referenced a damaged shipment and requested review after the standard refund window.",
    expectedResolution: "Recognize the damage exception or escalate instead of applying the strict time-window refusal.",
    severityTag: "critical",
    statusLabel: "Critical regression",
    llmFailure: true,
    qualityScore: 0.48,
    tokenScale: 0.86,
  }),
  createCuratedTrace({
    id: "trace_returns_exception_v19_recovery",
    scenarioId: "scn_refund_after_window_fix",
    status: "healthy",
    replayPriority: "high",
    diffPriority: "high",
    startTimeMs: atDemoTime(6, 10, 22),
    sessionId: "session_returns_exception_week1",
    profile: "returns_copilot",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "refund",
    customerTier: "self-serve",
    releaseVersion: "2026.04.13",
    totalCost: 0.0446,
    durationMs: 10200,
    escalationRequired: false,
    policyResult: "correct_exception_handled",
    storyLabel: "Recovery candidate restored refund exception handling",
    storySummary: "Version 19 preserved the cheaper routing path while restoring the damaged-shipment exception logic.",
    customerIntent: "Customer requested a refund after the normal window but supplied valid damage evidence.",
    expectedResolution: "Honor the approved exception path with a grounded explanation and next steps.",
    severityTag: "healthy",
    statusLabel: "Validated recovery",
    qualityScore: 0.91,
    tokenScale: 0.92,
  }),
  createCuratedTrace({
    id: "trace_policy_damage_claim_v4_hallucination",
    scenarioId: "scn_damaged_item_hallucination",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    startTimeMs: atDemoTime(4, 11, 36),
    sessionId: "session_damage_claim_policy",
    profile: "policy_grounding",
    promptName: "refund-policy-check",
    promptVersion: 4,
    issueType: "refund",
    customerTier: "self-serve",
    releaseVersion: "2026.04.11",
    totalCost: 0.0522,
    durationMs: 10900,
    escalationRequired: true,
    policyResult: "hallucinated_policy_denial",
    storyLabel: "Damaged-item policy checker invented a denial rule",
    storySummary: "The policy-grounding path fabricated unsupported policy text instead of asking for clarification or escalating.",
    customerIntent: "Customer claimed the replacement item arrived broken and asked whether photo evidence was enough for a refund.",
    expectedResolution: "Ask for clarification or escalate when the policy source is ambiguous, never invent denial language.",
    severityTag: "critical",
    statusLabel: "Policy hallucination",
    llmFailure: true,
    qualityScore: 0.39,
    tokenScale: 1.08,
  }),
  createCuratedTrace({
    id: "trace_premium_chargeback_v18_missed_escalation",
    scenarioId: "scn_vip_chargeback_missed_escalation",
    status: "error",
    replayPriority: "high",
    diffPriority: "high",
    startTimeMs: atDemoTime(4, 15, 9),
    sessionId: "session_chargeback_premium",
    profile: "premium_escalation",
    promptName: "support-reply",
    promptVersion: 18,
    issueType: "billing",
    customerTier: "premium",
    releaseVersion: "2026.04.11",
    totalCost: 0.0364,
    durationMs: 8700,
    escalationRequired: true,
    policyResult: "missed_escalation",
    storyLabel: "Premium billing dispute answered directly instead of escalating",
    storySummary: "A revenue-risk chargeback case stayed on the cheap self-serve path and bypassed the premium human queue.",
    customerIntent: "VIP customer reported a chargeback warning and threatened cancellation if support could not intervene quickly.",
    expectedResolution: "Escalate immediately to the premium billing desk.",
    severityTag: "critical",
    statusLabel: "Missed escalation",
    llmFailure: true,
    qualityScore: 0.41,
    tokenScale: 0.84,
  }),
  createCuratedTrace({
    id: "trace_premium_chargeback_v19_restored_escalation",
    scenarioId: "scn_vip_chargeback_restored_escalation",
    status: "healthy",
    replayPriority: "medium",
    diffPriority: "high",
    startTimeMs: atDemoTime(6, 12, 18),
    sessionId: "session_chargeback_premium",
    profile: "premium_escalation",
    promptName: "support-reply",
    promptVersion: 19,
    issueType: "billing",
    customerTier: "premium",
    releaseVersion: "2026.04.13",
    totalCost: 0.0391,
    durationMs: 9100,
    escalationRequired: true,
    policyResult: "correct_escalation",
    storyLabel: "Premium billing recovery restored the escalation handoff",
    storySummary: "The recovery path restored immediate human escalation for high-value chargeback risk.",
    customerIntent: "VIP customer reported a suspicious chargeback and requested urgent intervention.",
    expectedResolution: "Trigger the premium escalation route and preserve revenue context for the human queue.",
    severityTag: "healthy",
    statusLabel: "Escalation restored",
    qualityScore: 0.94,
    tokenScale: 0.9,
  }),
  createCuratedTrace({
    id: "trace_shipping_kb_timeout_failed",
    scenarioId: "scn_kb_timeout_failed",
    status: "error",
    replayPriority: "high",
    diffPriority: "medium",
    startTimeMs: atDemoTime(5, 8, 2),
    sessionId: "session_shipping_timeout_cluster",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 7,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.12",
    totalCost: 0.0629,
    durationMs: 14600,
    escalationRequired: false,
    policyResult: "degraded_answer_after_timeout",
    storyLabel: "Shipping resolution degraded during logistics lookup timeout",
    storySummary: "The shipping agent absorbed a live-status timeout and returned a weak answer after the fallback path kicked in late.",
    customerIntent: "Customer asked why a replacement shipment had been stalled for 48 hours without an updated carrier scan.",
    expectedResolution: "Use the fallback path quickly, set expectations clearly, and avoid vague answers.",
    severityTag: "warning",
    statusLabel: "Latency and quality degradation",
    kbTimeout: true,
    qualityScore: 0.52,
    tokenScale: 1.12,
  }),
  createCuratedTrace({
    id: "trace_shipping_kb_timeout_recovered",
    scenarioId: "scn_kb_timeout_recovered",
    status: "healthy",
    replayPriority: "high",
    diffPriority: "medium",
    startTimeMs: atDemoTime(6, 14, 28),
    sessionId: "session_shipping_timeout_cluster",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 7,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.13",
    totalCost: 0.0574,
    durationMs: 11200,
    escalationRequired: false,
    policyResult: "recovered_after_fallback",
    storyLabel: "Fallback shipping path recovered after timeout cluster",
    storySummary: "The revised fallback sequence kept quality high enough even while the logistics knowledge system remained unstable.",
    customerIntent: "Customer needed a grounded answer on a delayed replacement shipment after a carrier scan gap.",
    expectedResolution: "Explain the fallback status honestly and give a clear next checkpoint.",
    severityTag: "healthy",
    statusLabel: "Recovered fallback path",
    qualityScore: 0.88,
    tokenScale: 1.03,
  }),
];

interface BackgroundScenarioTemplate {
  id: string;
  profile: AgentKey;
  promptName: string;
  promptVersion: number;
  issueType: string;
  customerTier: string;
  releaseVersion: string;
  storyStem: string;
  customerIntent: string;
  expectedResolution: string;
  baseCost: number;
  baseDurationMs: number;
  severityTag: "healthy" | "warning" | "critical";
  statusLabel: string;
  policyResult: string;
  escalationRequired: boolean;
  sessionBase: string;
  language?: string;
  environment?: string;
  kbTimeout?: boolean;
  llmFailure?: boolean;
}

const backgroundScenarioTemplates: BackgroundScenarioTemplate[] = [
  {
    id: "shipping_status_refresh",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 6,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.07",
    storyStem: "Shipping status explanation stayed grounded",
    customerIntent: "Customer wants a plain-language explanation for a delayed delivery update.",
    expectedResolution: "Summarize the shipping state and next update window clearly.",
    baseCost: 0.018,
    baseDurationMs: 6400,
    severityTag: "healthy",
    statusLabel: "Healthy path",
    policyResult: "healthy_shipping_answer",
    escalationRequired: false,
    sessionBase: "session_shipping_status",
  },
  {
    id: "refund_clarification_needed",
    profile: "returns_copilot",
    promptName: "refund-policy-check",
    promptVersion: 3,
    issueType: "refund",
    customerTier: "self-serve",
    releaseVersion: "2026.04.08",
    storyStem: "Refund clarification request avoided a false denial",
    customerIntent: "Customer supplied partial return evidence and asked for a refund exception.",
    expectedResolution: "Request missing evidence before making a policy decision.",
    baseCost: 0.027,
    baseDurationMs: 7600,
    severityTag: "healthy",
    statusLabel: "Clarification path",
    policyResult: "clarification_requested",
    escalationRequired: false,
    sessionBase: "session_refund_clarification",
  },
  {
    id: "duplicate_charge_review",
    profile: "billing_guard",
    promptName: "billing-dispute-investigator",
    promptVersion: 11,
    issueType: "billing",
    customerTier: "premium",
    releaseVersion: "2026.04.10",
    storyStem: "Duplicate-charge review resolved billing friction",
    customerIntent: "Customer believes they were charged twice for the same subscription renewal.",
    expectedResolution: "Differentiate hold vs duplicate charge and explain the correction path.",
    baseCost: 0.025,
    baseDurationMs: 7200,
    severityTag: "healthy",
    statusLabel: "Billing issue resolved",
    policyResult: "healthy_duplicate_charge_answer",
    escalationRequired: false,
    sessionBase: "session_duplicate_charge",
  },
  {
    id: "account_lockout_fastpath",
    profile: "account_recovery",
    promptName: "account-recovery-guide",
    promptVersion: 5,
    issueType: "account",
    customerTier: "self-serve",
    releaseVersion: "2026.04.09",
    storyStem: "Account recovery fast path stayed secure and quick",
    customerIntent: "Customer cannot access a two-factor protected account after device replacement.",
    expectedResolution: "Guide recovery safely without leaking internal security details.",
    baseCost: 0.011,
    baseDurationMs: 4200,
    severityTag: "healthy",
    statusLabel: "Fast-path recovery",
    policyResult: "healthy_account_unlock_path",
    escalationRequired: false,
    sessionBase: "session_account_lockout",
  },
  {
    id: "premium_contract_escalation",
    profile: "premium_escalation",
    promptName: "escalation-triage",
    promptVersion: 7,
    issueType: "billing",
    customerTier: "enterprise",
    releaseVersion: "2026.04.09",
    storyStem: "Enterprise contract question escalated correctly",
    customerIntent: "Enterprise customer asked for urgent contract and invoice intervention.",
    expectedResolution: "Escalate to the revenue desk with complete account context.",
    baseCost: 0.032,
    baseDurationMs: 6100,
    severityTag: "healthy",
    statusLabel: "Correct escalation",
    policyResult: "correct_escalation",
    escalationRequired: true,
    sessionBase: "session_enterprise_contract",
  },
  {
    id: "fraud_pattern_review",
    profile: "fraud_watch",
    promptName: "fraud-risk-review",
    promptVersion: 2,
    issueType: "fraud",
    customerTier: "self-serve",
    releaseVersion: "2026.04.11",
    storyStem: "Fraud-watch run flagged suspicious refund behavior",
    customerIntent: "Multiple returns from related accounts suggest refund abuse.",
    expectedResolution: "Flag the account cluster and route to manual investigation.",
    baseCost: 0.034,
    baseDurationMs: 8300,
    severityTag: "warning",
    statusLabel: "Risk review triggered",
    policyResult: "manual_risk_review_triggered",
    escalationRequired: true,
    sessionBase: "session_refund_risk",
  },
  {
    id: "support_weekly_brief",
    profile: "voice_of_customer",
    promptName: "weekly-support-brief",
    promptVersion: 4,
    issueType: "reporting",
    customerTier: "internal",
    releaseVersion: "2026.04.13",
    storyStem: "Weekly support brief summarized the incident cluster",
    customerIntent: "Internal operator needs a concise weekly summary of quality, cost, and incident drift.",
    expectedResolution: "Surface the most important deltas with clear next actions.",
    baseCost: 0.041,
    baseDurationMs: 9800,
    severityTag: "healthy",
    statusLabel: "Executive summary generated",
    policyResult: "brief_generated",
    escalationRequired: false,
    sessionBase: "session_support_weekly_brief",
  },
  {
    id: "shipping_delay_warning",
    profile: "shipping_resolution",
    promptName: "shipping-delay-triage",
    promptVersion: 7,
    issueType: "shipping",
    customerTier: "self-serve",
    releaseVersion: "2026.04.12",
    storyStem: "Shipping status path stayed usable but slow",
    customerIntent: "Customer needs an update on a parcel delayed after carrier transfer.",
    expectedResolution: "Provide a grounded estimate and explain the transfer delay.",
    baseCost: 0.028,
    baseDurationMs: 11600,
    severityTag: "warning",
    statusLabel: "Slow but serviceable",
    policyResult: "slow_but_grounded_answer",
    escalationRequired: false,
    sessionBase: "session_shipping_slowpath",
  },
];

function buildBackgroundTrace(
  template: BackgroundScenarioTemplate,
  dayOffset: number,
  index: number,
  releaseVersion: string,
): Trace {
  const profile = agentProfiles[template.profile];
  const hour = 8 + ((index * 3) % 10);
  const minute = (index * 11) % 60;
  const startTimeMs = atDemoTime(dayOffset, hour, minute);
  const durationMs = template.baseDurationMs + ((index % 5) * 230);
  const totalCost = Number((template.baseCost + ((index % 7) * 0.0027)).toFixed(4));
  const qualityScore = template.severityTag === "healthy"
    ? Number((0.89 + ((index % 4) * 0.02)).toFixed(2))
    : template.severityTag === "warning"
      ? Number((0.72 + ((index % 4) * 0.03)).toFixed(2))
      : Number((0.45 + ((index % 3) * 0.04)).toFixed(2));
  const id = `trace_${template.id}_${String(dayOffset + 1).padStart(2, "0")}_${String(index + 1).padStart(3, "0")}`;
  const storyLabel = `${template.storyStem} (${dayOffset + 1}.${index + 1})`;
  const storySummary = buildGeneratedStorySummary(profile, template, dayOffset, index, qualityScore);

  return makeSupportTrace({
    id,
    scenarioId: `generated_${template.id}`,
    profile,
    promptName: template.promptName,
    promptVersion: template.promptVersion,
    issueType: template.issueType,
    customerTier: template.customerTier,
    releaseVersion,
    totalCost,
    durationMs,
    escalationRequired: template.escalationRequired,
    policyResult: template.policyResult,
    storyLabel,
    storySummary,
    customerIntent: template.customerIntent,
    expectedResolution: template.expectedResolution,
    severityTag: template.severityTag,
    statusLabel: template.statusLabel,
    startTimeMs,
    sessionId: `${template.sessionBase}_${String(dayOffset + 1).padStart(2, "0")}`,
    language: template.language ?? (index % 9 === 0 ? "es" : "en"),
    environment: template.environment ?? "production",
    kbTimeout: template.kbTimeout,
    llmFailure: template.llmFailure,
    qualityScore,
    tokenScale: 1 + ((index % 6) * 0.11),
    extraContext: {
      generated_fixture: true,
      generated_template: template.id,
      cohort: index % 2 === 0 ? "weekday_core" : "peak_load",
      operator_segment: profile.team,
      narrative_batch: `week_${dayOffset + 1}`,
      call_reason_detail: `${template.issueType}_${index % 4}`,
    },
  });
}

const backgroundTraces: Trace[] = [];
for (let day = 0; day < 7; day += 1) {
  backgroundScenarioTemplates.forEach((template, templateIndex) => {
    for (let variant = 0; variant < 10; variant += 1) {
      const releaseVersion = day <= 2 ? "2026.04.08" : day <= 4 ? "2026.04.11" : "2026.04.13";
      backgroundTraces.push(buildBackgroundTrace(template, day, (templateIndex * 10) + variant, releaseVersion));
    }
  });
}

export const supportCopilotBackgroundTraces: Trace[] = backgroundTraces;

export const supportCopilotDiffPairs: DemoDiffPair[] = [
  {
    id: "pair_returns_regression_story",
    title: "Returns exception regression",
    baselineTraceId: "trace_returns_exception_v17_baseline",
    comparisonTraceId: "trace_returns_exception_v18_regression",
    narrative: "The cost-optimized rollout is faster and cheaper, but it mishandles the damaged-shipment refund exception.",
  },
  {
    id: "pair_returns_recovery_story",
    title: "Returns recovery validation",
    baselineTraceId: "trace_returns_exception_v18_regression",
    comparisonTraceId: "trace_returns_exception_v19_recovery",
    narrative: "The recovery candidate restores grounded exception handling with only a modest cost increase.",
  },
  {
    id: "pair_policy_hallucination_story",
    title: "Policy hallucination investigation",
    baselineTraceId: "trace_returns_exception_v17_baseline",
    comparisonTraceId: "trace_policy_damage_claim_v4_hallucination",
    narrative: "The policy-check path invented unsupported denial language instead of clarifying or escalating.",
  },
  {
    id: "pair_premium_escalation_story",
    title: "Premium escalation recovery",
    baselineTraceId: "trace_premium_chargeback_v18_missed_escalation",
    comparisonTraceId: "trace_premium_chargeback_v19_restored_escalation",
    narrative: "Version 19 restores the premium billing escalation handoff for revenue-risk cases.",
  },
  {
    id: "pair_shipping_timeout_story",
    title: "Shipping timeout recovery",
    baselineTraceId: "trace_shipping_kb_timeout_failed",
    comparisonTraceId: "trace_shipping_kb_timeout_recovered",
    narrative: "The fallback path improved both response quality and latency after the logistics timeout cluster.",
  },
];

export const supportCopilotRegressions: DemoRegression[] = [
  {
    id: "reg_returns_exception_rollout",
    title: "Returns Resolution Copilot regressed after the compressed v18 rollout",
    severity: "critical",
    traceId: "trace_returns_exception_v18_regression",
    diffPairId: "pair_returns_regression_story",
    promptName: "support-reply",
    summary: "The flagship refund workflow became cheaper but incorrectly denied a damaged-shipment exception that the baseline handled correctly.",
  },
  {
    id: "reg_policy_grounding_hallucination",
    title: "Policy Grounding Reviewer hallucinated unsupported denial text",
    severity: "critical",
    traceId: "trace_policy_damage_claim_v4_hallucination",
    diffPairId: "pair_policy_hallucination_story",
    promptName: "refund-policy-check",
    summary: "The stricter policy branch fabricated a denial rule instead of asking for more evidence or escalating.",
  },
  {
    id: "reg_premium_missed_escalation",
    title: "Premium Escalation Triage missed chargeback escalation",
    severity: "warning",
    traceId: "trace_premium_chargeback_v18_missed_escalation",
    diffPairId: "pair_premium_escalation_story",
    promptName: "support-reply",
    summary: "A VIP billing case stayed on the cheap self-serve path instead of handing off to the premium queue.",
  },
  {
    id: "reg_shipping_timeout_cluster",
    title: "Shipping Delay Resolution degraded during a logistics timeout cluster",
    severity: "warning",
    traceId: "trace_shipping_kb_timeout_failed",
    diffPairId: "pair_shipping_timeout_story",
    promptName: "shipping-delay-triage",
    summary: "A live-status timeout raised latency and lowered answer quality during a high-volume shipping-support period.",
  },
  {
    id: "reg_returns_recovery_validated",
    title: "Returns recovery path validated on the weekly exception dataset",
    severity: "healthy",
    traceId: "trace_returns_exception_v19_recovery",
    diffPairId: "pair_returns_recovery_story",
    promptName: "support-reply",
    summary: "The v19 recovery path currently looks safe to promote across the refund exception cohort.",
  },
];

export const supportCopilotDatasets: DemoDataset[] = [
  {
    id: "dataset_returns_exception_week",
    name: "returns-exception-week",
    description: "Trace-derived refund and return exceptions collected across the incident week to validate the recovery candidate against realistic edge cases.",
    itemCount: 214,
    sourceTraceIds: [
      "trace_returns_exception_v17_baseline",
      "trace_returns_exception_v18_regression",
      "trace_returns_exception_v19_recovery",
      "trace_policy_damage_claim_v4_hallucination",
      "trace_refund_clarification_needed_02_011",
      "trace_refund_clarification_needed_05_014",
      "trace_refund_clarification_needed_07_019",
    ],
  },
  {
    id: "dataset_premium_billing_guardrails",
    name: "premium-billing-guardrails",
    description: "Premium billing and chargeback-support cases used to validate escalation behavior and revenue-risk handling.",
    itemCount: 93,
    sourceTraceIds: [
      "trace_premium_chargeback_v18_missed_escalation",
      "trace_premium_chargeback_v19_restored_escalation",
      "trace_duplicate_charge_review_04_021",
      "trace_premium_contract_escalation_03_045",
    ],
  },
  {
    id: "dataset_policy_grounding_failures",
    name: "policy-grounding-failures",
    description: "Failure cases where policy-heavy outputs drifted, over-fit, or hallucinated unsupported rules.",
    itemCount: 76,
    sourceTraceIds: [
      "trace_policy_damage_claim_v4_hallucination",
      "trace_returns_exception_v18_regression",
      "trace_fraud_pattern_review_06_053",
      "trace_refund_clarification_needed_03_013",
    ],
  },
  {
    id: "dataset_shipping_reliability_window",
    name: "shipping-reliability-window",
    description: "Shipping and logistics traces used to measure timeout recovery, latency, and operator-visible customer experience.",
    itemCount: 188,
    sourceTraceIds: [
      "trace_shipping_kb_timeout_failed",
      "trace_shipping_kb_timeout_recovered",
      "trace_shipping_status_refresh_01_001",
      "trace_shipping_delay_warning_05_071",
      "trace_shipping_status_refresh_07_010",
    ],
  },
  {
    id: "dataset_support_exec_weekly_summary",
    name: "support-exec-weekly-summary",
    description: "Executive-review cohort connecting customer-visible issues to budgets, SLAs, and experiment decisions.",
    itemCount: 54,
    sourceTraceIds: [
      "trace_returns_exception_v18_regression",
      "trace_shipping_kb_timeout_failed",
      "trace_support_weekly_brief_07_080",
      "trace_fraud_pattern_review_07_060",
    ],
  },
];

export const supportCopilotEvaluators: DemoEvaluator[] = [
  {
    id: "eval_returns_policy_correctness",
    name: "returns_policy_correctness",
    scoringType: "categorical",
    model: "gpt-4o",
    health: "critical",
    summary: "Flags the v18 refund rollout as incorrect on exception-heavy return scenarios.",
  },
  {
    id: "eval_escalation_correctness",
    name: "escalation_correctness",
    scoringType: "categorical",
    model: "gpt-4o-mini",
    health: "warning",
    summary: "Tracks whether premium and risk-sensitive cases are routed to humans early enough.",
  },
  {
    id: "eval_policy_groundedness",
    name: "policy_groundedness",
    scoringType: "numeric",
    model: "gpt-4o",
    health: "warning",
    summary: "Measures how often policy-heavy answers remain grounded in approved support rules.",
  },
  {
    id: "eval_shipping_latency_guardrail",
    name: "shipping_latency_guardrail",
    scoringType: "numeric",
    model: "gpt-4o-mini",
    health: "warning",
    summary: "Tracks whether cheaper logistics paths remain inside latency expectations during carrier instability.",
  },
  {
    id: "eval_operator_summary_quality",
    name: "operator_summary_quality",
    scoringType: "numeric",
    model: "gpt-4o",
    health: "healthy",
    summary: "Checks whether operator-visible summaries are specific enough to support real investigations.",
  },
];

export const supportCopilotExperiments: DemoExperiment[] = [
  {
    id: "exp_returns_recovery_v19",
    name: "returns-recovery-v19",
    datasetId: "dataset_returns_exception_week",
    status: "completed",
    summary: "Version 19 restores grounded refund exception handling across the weekly return-risk cohort while keeping cost close to the compressed rollout.",
    winningCandidate: "support-reply v19 for Returns Resolution Copilot",
  },
  {
    id: "exp_premium_escalation_tuning",
    name: "premium-escalation-tuning",
    datasetId: "dataset_premium_billing_guardrails",
    status: "running",
    summary: "Still tuning how aggressively chargeback-like billing cases should be escalated for premium accounts.",
  },
  {
    id: "exp_shipping_fallback_hardening",
    name: "shipping-fallback-hardening",
    datasetId: "dataset_shipping_reliability_window",
    status: "completed",
    summary: "The revised fallback sequence cuts the worst timeout impact without forcing every shipping case onto the expensive baseline model.",
    winningCandidate: "shipping-delay-triage v7 with fallback hardening",
  },
  {
    id: "exp_operator_summary_grounding",
    name: "operator-summary-grounding",
    datasetId: "dataset_support_exec_weekly_summary",
    status: "completed",
    summary: "Operator summaries are now specific enough to support investigation handoff and executive review without requiring a replay first.",
    winningCandidate: "weekly-support-brief v4",
  },
];

export const supportCopilotBudgets: DemoBudgetFixture[] = [
  {
    agentId: "Returns Resolution Copilot",
    budgetUsd: 18000,
    currentSpendUsd: 21340,
    status: "critical",
    summary: "The flagship return workflow overspent after the compressed rollout introduced retries, manual reviews, and customer follow-ups.",
  },
  {
    agentId: "Shipping Delay Resolution",
    budgetUsd: 12000,
    currentSpendUsd: 11380,
    status: "warning",
    summary: "Carrier-status instability and fallback logic pushed the shipping workflow close to its monthly budget guardrail.",
  },
  {
    agentId: "Premium Escalation Triage",
    budgetUsd: 6400,
    currentSpendUsd: 5880,
    status: "warning",
    summary: "Premium billing reviews and incident-era handoffs increased spend, but still look recoverable.",
  },
  {
    agentId: "Billing Operations Guard",
    budgetUsd: 7200,
    currentSpendUsd: 4820,
    status: "healthy",
    summary: "Billing dispute handling remained steady and mostly avoided the broader refund incident spillover.",
  },
  {
    agentId: "Account Recovery Assistant",
    budgetUsd: 4300,
    currentSpendUsd: 1890,
    status: "healthy",
    summary: "Account-recovery traffic stayed predictable and inexpensive throughout the same week.",
  },
  {
    agentId: "Policy Grounding Reviewer",
    budgetUsd: 5600,
    currentSpendUsd: 5310,
    status: "warning",
    summary: "Extra policy-verification traffic increased during the hallucination investigation and recovery validation work.",
  },
];

export const supportCopilotSlas: DemoSlaFixture[] = [
  {
    agentId: "Returns Resolution Copilot",
    maxDurationMs: 8000,
    minSuccessRate: 0.97,
    observedDurationMs: 9600,
    observedSuccessRate: 0.918,
    status: "critical",
    summary: "Returns Resolution Copilot breached both latency and success-rate expectations during the regression window.",
  },
  {
    agentId: "Shipping Delay Resolution",
    maxDurationMs: 12000,
    minSuccessRate: 0.96,
    observedDurationMs: 11400,
    observedSuccessRate: 0.952,
    status: "warning",
    summary: "Shipping fallback improvements helped, but the workflow remains near the SLA edge after the timeout cluster.",
  },
  {
    agentId: "Premium Escalation Triage",
    maxDurationMs: 5000,
    minSuccessRate: 0.99,
    observedDurationMs: 4300,
    observedSuccessRate: 0.987,
    status: "warning",
    summary: "Escalation quality improved, but high-value billing cases remain under close monitoring.",
  },
  {
    agentId: "Billing Operations Guard",
    maxDurationMs: 7000,
    minSuccessRate: 0.97,
    observedDurationMs: 6400,
    observedSuccessRate: 0.978,
    status: "healthy",
    summary: "Billing dispute handling remained comfortably inside target during the same weekly narrative.",
  },
  {
    agentId: "Account Recovery Assistant",
    maxDurationMs: 4500,
    minSuccessRate: 0.995,
    observedDurationMs: 3910,
    observedSuccessRate: 0.996,
    status: "healthy",
    summary: "Account recovery stayed fast and highly reliable even during peak support hours.",
  },
];

export const supportCopilotNotifications: DemoNotificationFixture[] = [
  {
    channelId: "channel_platform_ops",
    channelName: "#platform-ops",
    kind: "slack",
    status: "warning",
    summary: "Critical refund, SLA, and timeout alerts route here, including one warning-route delivery hiccup during the incident cluster.",
  },
  {
    channelId: "channel_returns_watch",
    channelName: "#returns-watch",
    kind: "slack",
    status: "critical",
    summary: "Refund-regression and policy-grounding alerts route here for the returns operations team.",
  },
  {
    channelId: "channel_premium_support_watch",
    channelName: "#premium-support-watch",
    kind: "slack",
    status: "healthy",
    summary: "Premium billing and escalation alerts route here with the corrected v19 handoff path.",
  },
  {
    channelId: "channel_exec_digest",
    channelName: "#exec-digest",
    kind: "slack",
    status: "healthy",
    summary: "Executive-level budget, experiment, and weekly-summary digests route here after major updates.",
  },
];

export const supportCopilotReplayTargetTraceIds = [
  "trace_returns_exception_v18_regression",
  "trace_returns_exception_v19_recovery",
  "trace_policy_damage_claim_v4_hallucination",
  "trace_premium_chargeback_v18_missed_escalation",
  "trace_shipping_kb_timeout_failed",
  "trace_shipping_kb_timeout_recovered",
];

export function buildMarketingHeroDemo(): MarketingHeroDemo {
  const allTraces = [...supportCopilotCuratedTraces.map((item) => item.trace), ...supportCopilotBackgroundTraces]
    .sort((a, b) => a.startTimeMs - b.startTimeMs);

  return {
    org: demoOrgs[0]!,
    prompts: supportCopilotPrompts,
    scenarios: supportCopilotScenarios,
    curatedTraces: supportCopilotCuratedTraces,
    backgroundTraces: supportCopilotBackgroundTraces,
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

  const totalTrackedSpend = hero.budgets.reduce((sum, item) => sum + item.currentSpendUsd, 0);
  const criticalRegressions = hero.regressions.filter((item) => item.severity === "critical").length;
  const atRiskBudgets = hero.budgets.filter((item) => item.status !== "healthy").length;

  return {
    ...hero,
    replayTargetTraceIds: supportCopilotReplayTargetTraceIds,
    overviewMetrics: [
      {
        label: "Monitored agents",
        value: String(new Set(hero.allTraces.map((trace) => trace.agentId)).size),
        supportingText: "The sandbox now covers realistic support operations across returns, billing, shipping, account recovery, fraud, and executive reporting.",
      },
      {
        label: "Runs in last 7d",
        value: hero.allTraces.length.toLocaleString(),
        supportingText: "The seeded sandbox story now spans a dense seven-day operating window instead of a tiny hand-written corpus.",
      },
      {
        label: "Open regressions",
        value: String(criticalRegressions + hero.regressions.filter((item) => item.severity === "warning").length),
        supportingText: "Refund quality drift, policy hallucination, escalation misses, and shipping reliability are all explorable from the same narrative.",
      },
      {
        label: "Modeled monthly spend",
        value: formatUsd(totalTrackedSpend),
        supportingText: `${atRiskBudgets} agent budgets are currently at risk in the same shared weekly story.`,
      },
    ],
    executiveMetrics: [
      {
        label: "Fleet reliability",
        value: "96.1%",
        supportingText: "Reliability dipped during the v18 rollout and partially recovered as the v19 fixes landed late in the week.",
      },
      {
        label: "Budget exposure",
        value: "$10.7k at risk",
        supportingText: "Overspend remains concentrated in return handling, shipping fallback volume, and policy-grounding review work.",
      },
      {
        label: "Replay-ready incidents",
        value: String(supportCopilotReplayTargetTraceIds.length),
        supportingText: "Each replay target now has clear story labels, realistic agent names, and connected prompt history.",
      },
      {
        label: "Promotion candidates",
        value: String(hero.experiments.filter((experiment) => Boolean(experiment.winningCandidate)).length),
        supportingText: "Multiple candidates are now visible, with returns v19 still leading the recovery narrative.",
      },
    ],
  };
}
