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
