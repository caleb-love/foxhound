/**
 * Core types for the Fox observability platform.
 * Shared across SDK and API packages.
 */

export type SpanKind = "tool_call" | "llm_call" | "agent_step" | "workflow" | "custom";

export type SpanStatus = "ok" | "error" | "unset";

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeMs: number;
  endTimeMs?: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean | null>;
  events: SpanEvent[];
}

export interface SpanEvent {
  timeMs: number;
  name: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface Trace {
  id: string;
  agentId: string;
  sessionId?: string;
  spans: Span[];
  startTimeMs: number;
  endTimeMs?: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface AgentSession {
  id: string;
  agentId: string;
  startedAt: string;
  endedAt?: string;
  traceIds: string[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  agentId: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  eventType: string;
  payload: Record<string, unknown>;
}

// ── Evaluation types ───────────────────────────────────────────────────────

export type ScoreSource = "manual" | "llm_judge" | "sdk" | "user_feedback";

export interface Score {
  id: string;
  orgId: string;
  traceId: string;
  spanId?: string;
  name: string;
  value?: number;
  label?: string;
  source: ScoreSource;
  comment?: string;
  userId?: string;
  createdAt: string;
}

export type ScoringType = "numeric" | "categorical";

export interface Evaluator {
  id: string;
  orgId: string;
  name: string;
  promptTemplate: string;
  model: string;
  scoringType: ScoringType;
  labels: string[];
  enabled: boolean;
  createdAt: string;
}

export type EvaluatorRunStatus = "pending" | "running" | "completed" | "failed";

export interface EvaluatorRun {
  id: string;
  evaluatorId: string;
  traceId: string;
  scoreId?: string;
  status: EvaluatorRunStatus;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AnnotationQueue {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  scoreConfigs: Array<{ name: string; type: ScoringType; labels?: string[] }>;
  createdAt: string;
}

export type AnnotationQueueItemStatus = "pending" | "completed" | "skipped";

export interface AnnotationQueueItem {
  id: string;
  queueId: string;
  traceId: string;
  status: AnnotationQueueItemStatus;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
}

// ── Dataset & Experiment types ────────────────────────────────────────────

export interface Dataset {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
  createdAt: string;
}

export type ExperimentStatus = "pending" | "running" | "completed" | "failed";

export interface Experiment {
  id: string;
  orgId: string;
  datasetId: string;
  name: string;
  config: Record<string, unknown>;
  status: ExperimentStatus;
  createdAt: string;
  completedAt?: string;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  datasetItemId: string;
  output?: Record<string, unknown>;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  createdAt: string;
}
