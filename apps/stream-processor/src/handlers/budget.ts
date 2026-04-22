/**
 * Budget handler (WP14).
 *
 * Maintains per-(agent, periodKey) running cost totals plus a firing
 * ledger. When cumulative spend crosses either the alert-threshold
 * fraction (default 80 %) or 100 % of the agent's budget, emits a
 * `cost_budget_exceeded` event at the appropriate severity.
 *
 * Firing discipline:
 *   - Warning (threshold %) fires at most once per period per agent.
 *   - Critical (exceeded) fires at most once per period per agent.
 *   - The `threshold` and `exceeded` bits are per-period; they reset
 *     automatically when the period key rotates because the keyed map
 *     entry is replaced on first span of the new period.
 *
 * Accumulator clock discipline (Pattern 9):
 *   - Period boundaries are computed from `now` (wall clock the
 *     processor owns), not from span timestamps. A span with a skewed
 *     `startTimeMs` never rolls the period forward or backward.
 *
 * State bound: one accumulator per (orgId, agentId) at any time plus
 * per-(agentId, periodKey, flag) entries in the firing ledger.
 */

import type { AlertEvent, AlertSeverity } from "@foxhound/notifications";
import {
  type AlertEmitter,
  type DataAccess,
  type SpanHandler,
  type SpanObservation,
  type TraceCloseObservation,
  periodKey,
  periodStartMs,
  spanCostUsd,
} from "./types.js";

export interface BudgetHandlerOptions {
  readonly data: DataAccess;
  readonly emitter: AlertEmitter;
  readonly now?: () => number;
}

interface PeriodAcc {
  readonly periodKey: string;
  readonly periodStart: number;
  totalUsd: number;
  warnedAtPct: number | null; // threshold % at which the warning fired
  exceededFired: boolean;
}

export class BudgetHandler implements SpanHandler {
  readonly name = "budget";
  private readonly accs = new Map<string, PeriodAcc>();
  private readonly now: () => number;
  private readonly data: DataAccess;
  private readonly emitter: AlertEmitter;

  constructor(opts: BudgetHandlerOptions) {
    this.now = opts.now ?? Date.now;
    this.data = opts.data;
    this.emitter = opts.emitter;
  }

  async onSpan(obs: SpanObservation): Promise<void> {
    const cost = spanCostUsd(obs.span);
    if (cost <= 0) return;

    const config = await this.data.getAgentConfig(obs.orgId, obs.agentId);
    if (!config || config.costBudgetUsd === null || config.costBudgetUsd <= 0) return;

    const period = config.budgetPeriod;
    const thresholdPct = config.costAlertThresholdPct ?? 80;
    const now = this.now();
    const keyOrg = `${obs.orgId}::${obs.agentId}`;
    const currentPeriodStart = periodStartMs(now, period);
    const currentPeriodKey = periodKey(currentPeriodStart, period);

    let acc = this.accs.get(keyOrg);
    if (!acc || acc.periodKey !== currentPeriodKey) {
      acc = {
        periodKey: currentPeriodKey,
        periodStart: currentPeriodStart,
        totalUsd: 0,
        warnedAtPct: null,
        exceededFired: false,
      };
      this.accs.set(keyOrg, acc);
    }

    acc.totalUsd += cost;

    const pctOfBudget = (acc.totalUsd / config.costBudgetUsd) * 100;

    if (!acc.exceededFired && acc.totalUsd >= config.costBudgetUsd) {
      acc.exceededFired = true;
      await this.fire("critical", obs, {
        acc,
        budget: config.costBudgetUsd,
        pct: pctOfBudget,
        period,
      });
      return;
    }

    if (acc.warnedAtPct === null && pctOfBudget >= thresholdPct && pctOfBudget < 100) {
      acc.warnedAtPct = thresholdPct;
      await this.fire("high", obs, {
        acc,
        budget: config.costBudgetUsd,
        pct: pctOfBudget,
        period,
      });
    }
  }

  onTraceClose(_obs: TraceCloseObservation): void {
    /* span-level costs already accumulated during onSpan. */
  }

  onTick(now: number): void {
    // Evict accumulators whose period is >1 period in the past.
    // Lightweight: if wall-clock advanced past periodStart + 45 days
    // (safe upper bound for "monthly"), drop.
    const cutoff = now - 45 * 24 * 60 * 60 * 1000;
    for (const [k, acc] of this.accs) {
      if (acc.periodStart < cutoff) this.accs.delete(k);
    }
  }

  /** Test/metrics hook. */
  snapshot(orgId: string, agentId: string): PeriodAcc | undefined {
    const v = this.accs.get(`${orgId}::${agentId}`);
    if (!v) return undefined;
    return { ...v };
  }

  private async fire(
    severity: AlertSeverity,
    obs: SpanObservation,
    meta: { acc: PeriodAcc; budget: number; pct: number; period: string },
  ): Promise<void> {
    const event: AlertEvent = {
      type: "cost_budget_exceeded",
      severity,
      orgId: obs.orgId,
      agentId: obs.agentId,
      traceId: obs.traceId,
      message:
        severity === "critical"
          ? `Agent "${obs.agentId}" exceeded $${meta.budget.toFixed(2)} ${meta.period} budget (current spend $${meta.acc.totalUsd.toFixed(2)}).`
          : `Agent "${obs.agentId}" at ${meta.pct.toFixed(1)}% of $${meta.budget.toFixed(2)} ${meta.period} budget (current spend $${meta.acc.totalUsd.toFixed(2)}).`,
      metadata: {
        spend: meta.acc.totalUsd,
        budget: meta.budget,
        periodKey: meta.acc.periodKey,
        pctOfBudget: meta.pct,
        period: meta.period,
      },
      occurredAt: new Date(this.now()),
    };
    await this.emitter.emit(event);
  }
}
