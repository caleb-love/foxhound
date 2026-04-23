/**
 * Handler port contract shared by all four WP14 handlers.
 *
 * Handlers are pure with respect to the stream processor:
 *   - They receive `SpanObservation` per span and `TraceCloseObservation`
 *     per closed trace, both already carrying `orgId` derived from the
 *     queue header and re-checked against the batch/span orgId.
 *   - They dispatch alerts through `AlertEmitter`, a thin port around
 *     `@foxhound/notifications`. Tests pass a spy; production wires the
 *     real dispatcher.
 *   - They read org-scoped config via `DataAccess`. Tests pass a stub;
 *     production wires `@foxhound/db`.
 *
 * Handlers MUST:
 *   1. Carry `orgId` through every operation (tenant scoping).
 *   2. Maintain bounded state (e.g. RollingWindow).
 *   3. Use `now()` from the processor's clock — never `Date.now()` inline,
 *      never a data-field timestamp (Pattern 9).
 */

import type { Span, Trace } from "@foxhound/types";
import type { AlertEvent, AlertRule, NotificationChannel } from "@foxhound/notifications";

export interface SpanObservation {
  readonly orgId: string;
  readonly agentId: string;
  readonly traceId: string;
  readonly span: Span;
  /** Wall-clock ms the processor observed this span. */
  readonly observedMs: number;
}

export interface TraceCloseObservation {
  readonly orgId: string;
  readonly agentId: string;
  readonly traceId: string;
  readonly trace: Trace;
  /** Wall-clock ms the processor observed trace close. */
  readonly observedMs: number;
  /** Close reason surfaced by the processor (idle/periodic/horizon). */
  readonly reason: "idle" | "periodic" | "horizon" | "force";
}

export interface SpanHandler {
  readonly name: string;
  onSpan(obs: SpanObservation): Promise<void> | void;
  onTraceClose(obs: TraceCloseObservation): Promise<void> | void;
  /** Periodic tick; handlers use this to prune state or fire batch alerts. */
  onTick?(now: number): Promise<void> | void;
}

export interface AlertEmitter {
  /**
   * Dispatch an alert event. Implementations delegate to
   * `@foxhound/notifications.dispatchAlert`. Errors must not throw back
   * into the handler — alert delivery is fire-and-forget for the stream
   * processor; retries live in `@foxhound/notifications`.
   */
  emit(event: AlertEvent): Promise<void>;
}

export interface AgentConfigView {
  readonly orgId: string;
  readonly agentId: string;
  readonly costBudgetUsd: number | null;
  readonly budgetPeriod: "daily" | "weekly" | "monthly";
  readonly costAlertThresholdPct: number | null;
  readonly maxDurationMs: number | null;
  readonly minSuccessRate: number | null;
  readonly evaluationWindowMs: number | null;
  readonly minSampleSize: number | null;
}

export interface BaselineView {
  readonly orgId: string;
  readonly agentId: string;
  readonly agentVersion: string;
  readonly sampleSize: number;
  readonly spanStructure: Record<string, number>;
}

export interface EvalTriggerRule {
  readonly id: string;
  readonly orgId: string;
  readonly agentId: string;
  readonly evaluatorId: string;
  /** Fire this evaluator when trace.attributes['foxhound.eval_tag'] matches. */
  readonly matchTag: string | null;
  /** Require trace status === 'error'. */
  readonly onError: boolean;
  /** Fire with this probability (0..1). */
  readonly sampleRate: number;
}

export interface DataAccess {
  getAgentConfig(orgId: string, agentId: string): Promise<AgentConfigView | null>;
  getBaseline(orgId: string, agentId: string, agentVersion: string): Promise<BaselineView | null>;
  listEvalTriggers(orgId: string): Promise<readonly EvalTriggerRule[]>;
  /**
   * Returns alert rules for the org, along with a channel map keyed by
   * channel ID. The processor filters by `eventType` at dispatch time so
   * this call is cached per-org on a short TTL.
   */
  getAlertRouting(orgId: string): Promise<{
    rules: readonly AlertRule[];
    channels: Map<string, NotificationChannel>;
  }>;
  /**
   * Enqueue an evaluator run. The stream processor is push-only for
   * alerts; evaluator runs are long-running and stay on the existing
   * evaluator queue.
   */
  enqueueEvaluatorRun(input: {
    orgId: string;
    agentId: string;
    traceId: string;
    evaluatorId: string;
  }): Promise<void>;
}

/**
 * Stable cost-attribute lookup on a span. The stream processor does not
 * try to compute cost from token counts; it reads a canonical attribute
 * written by the SDK or the ingestion pipeline. Unknown costs return 0.
 */
export const COST_ATTR = "foxhound.cost_usd";
export function spanCostUsd(span: Span): number {
  const v = span.attributes[COST_ATTR];
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return 0;
}

export function spanDurationMs(span: Span): number {
  if (span.endTimeMs === undefined) return 0;
  const d = span.endTimeMs - span.startTimeMs;
  return d > 0 ? d : 0;
}

export function spanIsError(span: Span): boolean {
  return span.status === "error";
}

/** Period key for the cost window, e.g. "2026-04-20" for daily. */
export function periodKey(periodStartMs: number, period: "daily" | "weekly" | "monthly"): string {
  const d = new Date(periodStartMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (period === "monthly") return `${y}-${m}`;
  if (period === "weekly") {
    // ISO week number (Monday-start).
    const date = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = date.getTime();
    date.setUTCMonth(0, 1);
    if (date.getUTCDay() !== 4) {
      date.setUTCMonth(0, 1 + ((4 - date.getUTCDay() + 7) % 7));
    }
    const week = 1 + Math.round((firstThursday - date.getTime()) / (7 * 24 * 3600 * 1000));
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  return `${y}-${m}-${day}`;
}

/**
 * Period start boundary in ms UTC for a given `now` and period type.
 * Used as the SLA/budget accumulator reset clock.
 */
export function periodStartMs(now: number, period: "daily" | "weekly" | "monthly"): number {
  const d = new Date(now);
  if (period === "daily") {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if (period === "weekly") {
    const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0
    const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayNum * 86_400_000;
    return ms;
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
