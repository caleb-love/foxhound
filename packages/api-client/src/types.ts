import type {
  Trace,
  Score,
  Evaluator,
  EvaluatorRun,
  AnnotationQueue,
  AnnotationQueueItem,
  Dataset,
  Experiment,
} from "@foxhound/types";

// ── Config ──────────────────────────────────────────────────────────────────

export interface FoxhoundApiConfig {
  endpoint: string;
  apiKey: string;
}

// ── Traces ──────────────────────────────────────────────────────────────────

export interface TraceListResponse {
  data: Trace[];
  pagination: { page: number; limit: number; count: number };
}

export interface ReplayResponse {
  traceId: string;
  spanId: string;
  context: Record<string, unknown>;
}

export interface DiffResponse {
  runA: string;
  runB: string;
  divergences: Array<{
    spanName: string;
    kind: string;
    difference: string;
  }>;
}

// ── Alert Rules ─────────────────────────────────────────────────────────────

export type AlertEventType =
  | "agent_failure"
  | "anomaly_detected"
  | "cost_spike"
  | "compliance_violation";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface AlertRule {
  id: string;
  orgId: string;
  eventType: AlertEventType;
  minSeverity: AlertSeverity;
  channelId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleListResponse {
  data: AlertRule[];
}

// ── Notification Channels ───────────────────────────────────────────────────

export type ChannelKind = "slack";

export interface NotificationChannel {
  id: string;
  orgId: string;
  kind: ChannelKind;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelListResponse {
  data: NotificationChannel[];
}

// ── API Keys ────────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  key: string;
}

export interface ApiKeyListResponse {
  data: ApiKeyRecord[];
}

// ── Auth ────────────────────────────────────────────────────────────────────

export type MemberRole = "owner" | "admin" | "member";

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string };
  org: { id: string; name: string; slug: string };
}

export interface MeResponse {
  user: { id: string; email: string; name: string };
  org: { id: string; name: string; slug: string } | null;
  role: MemberRole | null;
}

// ── Health / Usage ──────────────────────────────────────────────────────────

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthResponse {
  status: HealthStatus;
  version: string;
}

export interface UsageResponse {
  spansUsed: number;
  spansLimit: number;
  period: string;
}

// ── Billing ────────────────────────────────────────────────────────────────

export type CheckoutPlan = "pro_monthly" | "pro_annual" | "team_monthly" | "team_annual";

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export interface BillingStatusResponse {
  plan: string;
  period: string;
  spanCount: number;
  nextBillingDate: string | null;
}

// ── Scores ─────────────────────────────────────────────────────────────────

export interface ScoreListResponse {
  data: Score[];
  pagination: { page: number; limit: number; count: number };
}

export interface TraceScoresResponse {
  data: Score[];
}

// ── Evaluators ─────────────────────────────────────────────────────────────

export interface EvaluatorListResponse {
  data: Evaluator[];
}

export interface TriggerEvaluatorRunsResponse {
  message: string;
  runs: Array<{ id: string; traceId: string; status: string }>;
}

// ── Annotation Queues ──────────────────────────────────────────────────────

export interface AnnotationQueueListResponse {
  data: AnnotationQueue[];
}

export interface AnnotationQueueWithStats extends AnnotationQueue {
  stats: { pending: number; completed: number; skipped: number; total: number };
}

export interface AddAnnotationItemsResponse {
  added: number;
  items: AnnotationQueueItem[];
}

export interface SubmitAnnotationResponse {
  item: AnnotationQueueItem;
  scores: Score[];
}

// ── Datasets ──────────────────────────────────────────────────────────────

export interface DatasetListResponse {
  data: import("@foxhound/types").Dataset[];
}

export interface DatasetWithCount extends Dataset {
  itemCount: number;
}

export interface DatasetItemListResponse {
  data: import("@foxhound/types").DatasetItem[];
  pagination: { page: number; limit: number; count: number };
}

export interface FromTracesResponse {
  added: number;
  items: import("@foxhound/types").DatasetItem[];
}

// ── Experiments ───────────────────────────────────────────────────────────

export interface ExperimentListResponse {
  data: import("@foxhound/types").Experiment[];
}

export interface ExperimentWithRuns extends Experiment {
  runs: import("@foxhound/types").ExperimentRun[];
}

export interface CreateExperimentResponse {
  experiment: import("@foxhound/types").Experiment;
  runCount: number;
  message: string;
}

export interface ExperimentComparisonResponse {
  experiments: import("@foxhound/types").Experiment[];
  runs: import("@foxhound/types").ExperimentRun[];
  items: import("@foxhound/types").DatasetItem[];
  scores: Score[];
}

// ── Agent Intelligence (Phase 4) ────────────────────────────────────────

export interface AgentConfigResponse {
  id: string;
  orgId: string;
  agentId: string;
  costBudgetUsd: string | null;
  costAlertThresholdPct: number | null;
  budgetPeriod: string | null;
  maxDurationMs: number | null;
  minSuccessRate: string | null;
  evaluationWindowMs: number | null;
  minSampleSize: number | null;
  lastCostStatus: Record<string, unknown> | null;
  lastSlaStatus: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfigListResponse {
  data: AgentConfigResponse[];
  pagination: { page: number; limit: number; count: number };
}

export interface BaselineResponse {
  id: string;
  agentId: string;
  agentVersion: string;
  sampleSize: number;
  spanStructure: Record<string, number>;
  createdAt: string;
}

export interface BaselineListResponse {
  data: BaselineResponse[];
}

// ── Prompts ──────────────────────────────────────────────────────────────

export interface PromptResponse {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptListResponse {
  data: PromptResponse[];
}

export interface PromptVersionResponse {
  id: string;
  promptId: string;
  version: number;
  content: string;
  model: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  createdBy: string | null;
  labels?: string[];
}

export interface PromptVersionListResponse {
  data: PromptVersionResponse[];
}

export interface ResolvedPromptResponse {
  name: string;
  label: string;
  version: number;
  content: string;
  model: string | null;
  config: Record<string, unknown>;
}

export interface RegressionReportResponse {
  agentId: string;
  previousVersion: string;
  newVersion: string;
  regressions: Array<{
    type: "missing" | "new";
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }>;
  sampleSize: { before: number; after: number };
}
