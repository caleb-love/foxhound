/**
 * Test helpers shared across handler tests.
 */

import type { Span, SpanKind, SpanStatus, Trace } from "@foxhound/types";
import type { AlertEvent, AlertRule, NotificationChannel } from "@foxhound/notifications";
import type {
  AgentConfigView,
  AlertEmitter,
  BaselineView,
  DataAccess,
  EvalTriggerRule,
  TraceCloseObservation,
  SpanObservation,
} from "./types.js";

export function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: overrides.traceId ?? "trace-1",
    spanId: overrides.spanId ?? `span-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? "llm.chat",
    kind: (overrides.kind as SpanKind) ?? "llm_call",
    startTimeMs: overrides.startTimeMs ?? 1_700_000_000_000,
    endTimeMs: overrides.endTimeMs ?? 1_700_000_000_100,
    status: (overrides.status as SpanStatus) ?? "ok",
    attributes: overrides.attributes ?? {},
    events: overrides.events ?? [],
    ...(overrides.parentSpanId !== undefined ? { parentSpanId: overrides.parentSpanId } : {}),
  };
}

export function makeTrace(overrides: Partial<Trace> = {}): Trace {
  const spans = overrides.spans ?? [makeSpan()];
  const starts = spans.map((s) => s.startTimeMs);
  const ends = spans.map((s) => s.endTimeMs ?? s.startTimeMs);
  return {
    id: overrides.id ?? "trace-1",
    agentId: overrides.agentId ?? "agent-a",
    spans,
    startTimeMs: overrides.startTimeMs ?? Math.min(...starts),
    endTimeMs: overrides.endTimeMs ?? Math.max(...ends),
    metadata: overrides.metadata ?? {},
  };
}

export function makeCloseObs(overrides: Partial<TraceCloseObservation> = {}): TraceCloseObservation {
  const trace = overrides.trace ?? makeTrace();
  return {
    orgId: overrides.orgId ?? "org-a",
    agentId: overrides.agentId ?? trace.agentId,
    traceId: overrides.traceId ?? trace.id,
    trace,
    observedMs: overrides.observedMs ?? 1_700_000_001_000,
    reason: overrides.reason ?? "idle",
  };
}

export function makeSpanObs(overrides: Partial<SpanObservation> = {}): SpanObservation {
  const span = overrides.span ?? makeSpan();
  return {
    orgId: overrides.orgId ?? "org-a",
    agentId: overrides.agentId ?? "agent-a",
    traceId: overrides.traceId ?? span.traceId,
    span,
    observedMs: overrides.observedMs ?? 1_700_000_000_000,
  };
}

export function spyEmitter(): AlertEmitter & { events: AlertEvent[] } {
  const events: AlertEvent[] = [];
  return {
    events,
    async emit(e) {
      events.push(e);
    },
  };
}

export interface StubDataAccess extends DataAccess {
  configs: Map<string, AgentConfigView>;
  baselines: Map<string, BaselineView>;
  triggers: Map<string, EvalTriggerRule[]>;
  evaluatorRuns: Array<{ orgId: string; agentId: string; traceId: string; evaluatorId: string }>;
}

export function stubData(): StubDataAccess {
  const configs = new Map<string, AgentConfigView>();
  const baselines = new Map<string, BaselineView>();
  const triggers = new Map<string, EvalTriggerRule[]>();
  const evaluatorRuns: StubDataAccess["evaluatorRuns"] = [];
  return {
    configs,
    baselines,
    triggers,
    evaluatorRuns,
    async getAgentConfig(orgId, agentId) {
      return configs.get(`${orgId}::${agentId}`) ?? null;
    },
    async getBaseline(orgId, agentId, agentVersion) {
      return baselines.get(`${orgId}::${agentId}::${agentVersion}`) ?? null;
    },
    async listEvalTriggers(orgId) {
      return triggers.get(orgId) ?? [];
    },
    async getAlertRouting(_orgId) {
      const rules: AlertRule[] = [];
      const channels = new Map<string, NotificationChannel>();
      return { rules, channels };
    },
    async enqueueEvaluatorRun(input) {
      evaluatorRuns.push({ ...input });
    },
  };
}

export function setConfig(
  data: StubDataAccess,
  partial: Partial<AgentConfigView> & { orgId: string; agentId: string },
): void {
  const defaults: AgentConfigView = {
    orgId: partial.orgId,
    agentId: partial.agentId,
    costBudgetUsd: null,
    budgetPeriod: "daily",
    costAlertThresholdPct: 80,
    maxDurationMs: null,
    minSuccessRate: null,
    evaluationWindowMs: null,
    minSampleSize: null,
  };
  data.configs.set(`${partial.orgId}::${partial.agentId}`, { ...defaults, ...partial });
}
