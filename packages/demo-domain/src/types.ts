export interface DemoSpanEvent {
  timeMs?: number;
  name: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface DemoSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: "llm_call" | "tool_call" | "agent_step" | "workflow" | "custom";
  startTimeMs: number;
  endTimeMs?: number;
  status: "ok" | "error" | "unset";
  attributes: Record<string, string | number | boolean | null>;
  events: DemoSpanEvent[];
}

export interface DemoTrace {
  id: string;
  agentId: string;
  sessionId?: string;
  startTimeMs: number;
  endTimeMs?: number;
  spans: DemoSpan[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface DemoOrg {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "team" | "enterprise";
  llmEvaluationEnabled: boolean;
  role: "primary" | "secondary" | "control";
  description: string;
}

export interface DemoPromptVersion {
  version: number;
  model: string;
  summary: string;
  narrativeRole: string;
}

export interface DemoPrompt {
  id: string;
  name: string;
  purpose: string;
  versions: DemoPromptVersion[];
}

export interface DemoScenario {
  id: string;
  title: string;
  issueType: string;
  customerTier: string;
  promptName: string;
  promptVersion: number;
  narrativeRole: string;
  expectedOutcome: string;
}

export interface DemoCuratedTrace {
  id: string;
  scenarioId: string;
  trace: DemoTrace;
  status: "healthy" | "degraded" | "error";
  replayPriority: "low" | "medium" | "high";
  diffPriority: "low" | "medium" | "high";
}

export interface DemoDiffPair {
  id: string;
  title: string;
  baselineTraceId: string;
  comparisonTraceId: string;
  narrative: string;
}

export interface DemoRegression {
  id: string;
  title: string;
  severity: "healthy" | "warning" | "critical";
  traceId: string;
  diffPairId: string;
  promptName?: string;
  summary: string;
}

export interface DemoDataset {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  sourceTraceIds: string[];
}

export interface DemoEvaluator {
  id: string;
  name: string;
  scoringType: "numeric" | "categorical";
  model: string;
  health: "healthy" | "warning" | "critical";
  summary: string;
}

export interface DemoExperiment {
  id: string;
  name: string;
  datasetId: string;
  status: "pending" | "running" | "completed" | "failed";
  summary: string;
  winningCandidate?: string;
}

export interface DemoBudgetFixture {
  agentId: string;
  budgetUsd: number;
  currentSpendUsd: number;
  status: "healthy" | "warning" | "critical";
  summary: string;
}

export interface DemoSlaFixture {
  agentId: string;
  maxDurationMs: number;
  minSuccessRate: number;
  observedDurationMs: number;
  observedSuccessRate: number;
  status: "healthy" | "warning" | "critical";
  summary: string;
}

export interface DemoNotificationFixture {
  channelId: string;
  channelName: string;
  kind: "slack";
  status: "healthy" | "warning" | "critical";
  summary: string;
}

export interface MarketingHeroDemo {
  org: DemoOrg;
  prompts: DemoPrompt[];
  scenarios: DemoScenario[];
  curatedTraces: DemoCuratedTrace[];
  backgroundTraces: DemoTrace[];
  allTraces: DemoTrace[];
  diffPairs: DemoDiffPair[];
  regressions: DemoRegression[];
  datasets: DemoDataset[];
  evaluators: DemoEvaluator[];
  experiments: DemoExperiment[];
  budgets: DemoBudgetFixture[];
  slas: DemoSlaFixture[];
  notifications: DemoNotificationFixture[];
}

export interface LocalReviewDemo extends MarketingHeroDemo {
  replayTargetTraceIds: string[];
  overviewMetrics: Array<{ label: string; value: string; supportingText: string }>;
  executiveMetrics: Array<{ label: string; value: string; supportingText: string }>;
}
