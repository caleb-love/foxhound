/**
 * Eval-trigger handler (WP14).
 *
 * On each closed trace, consults the org's configured eval triggers and
 * enqueues evaluator runs on the existing evaluator BullMQ queue when
 * conditions match. The stream processor does not run the evaluator
 * itself — evaluators are long-running LLM-as-judge jobs that stay on
 * their dedicated queue. This handler only decides which (trace,
 * evaluator) pairs to schedule.
 *
 * Trigger conditions:
 *   - `matchTag`: enqueue if `trace.metadata['foxhound.eval_tag']` equals
 *     the rule's `matchTag`.
 *   - `onError`: enqueue if any span in the trace has status === 'error'.
 *   - `sampleRate`: per-trace Bernoulli sample.
 *
 * Caching:
 *   - Eval-trigger rules are cached per-org for `rulesTtlMs` to avoid
 *     hammering the control-plane DB on every trace close.
 *
 * Tenancy:
 *   - Triggers only apply to the trace's `orgId`. Cross-org triggers
 *     cannot fire because `listEvalTriggers(orgId)` is scoped.
 */

import {
  type DataAccess,
  type EvalTriggerRule,
  type SpanHandler,
  type SpanObservation,
  type TraceCloseObservation,
} from "./types.js";

export interface EvalTriggerHandlerOptions {
  readonly data: DataAccess;
  readonly rulesTtlMs?: number;
  readonly now?: () => number;
  /** Test hook: RNG for sample-rate. */
  readonly random?: () => number;
}

interface CacheEntry {
  readonly rules: readonly EvalTriggerRule[];
  readonly loadedMs: number;
}

const DEFAULT_TTL_MS = 30_000;
const EVAL_TAG_ATTR = "foxhound.eval_tag";

export class EvalTriggerHandler implements SpanHandler {
  readonly name = "eval-trigger";
  private readonly cache = new Map<string, CacheEntry>();
  private readonly data: DataAccess;
  private readonly rulesTtlMs: number;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(opts: EvalTriggerHandlerOptions) {
    this.data = opts.data;
    this.rulesTtlMs = opts.rulesTtlMs ?? DEFAULT_TTL_MS;
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? Math.random;
  }

  onSpan(_obs: SpanObservation): void {
    /* trace-level only. */
  }

  async onTraceClose(obs: TraceCloseObservation): Promise<void> {
    const rules = await this.rulesFor(obs.orgId);
    if (rules.length === 0) return;

    const matchTag = extractEvalTag(obs);
    const hasError = obs.trace.spans.some((s) => s.status === "error");

    for (const rule of rules) {
      if (rule.agentId !== obs.agentId) continue;
      if (!this.matches(rule, matchTag, hasError)) continue;
      await this.data.enqueueEvaluatorRun({
        orgId: obs.orgId,
        agentId: obs.agentId,
        traceId: obs.traceId,
        evaluatorId: rule.evaluatorId,
      });
    }
  }

  onTick(now: number): void {
    for (const [k, v] of this.cache) {
      if (now - v.loadedMs > this.rulesTtlMs) this.cache.delete(k);
    }
  }

  private matches(
    rule: EvalTriggerRule,
    matchTag: string | null,
    hasError: boolean,
  ): boolean {
    if (rule.matchTag !== null) {
      if (matchTag !== rule.matchTag) return false;
    }
    if (rule.onError && !hasError) return false;
    if (rule.sampleRate < 1) {
      if (this.random() > rule.sampleRate) return false;
    }
    return true;
  }

  private async rulesFor(orgId: string): Promise<readonly EvalTriggerRule[]> {
    const entry = this.cache.get(orgId);
    const now = this.now();
    if (entry && now - entry.loadedMs <= this.rulesTtlMs) return entry.rules;
    const rules = await this.data.listEvalTriggers(orgId);
    this.cache.set(orgId, { rules, loadedMs: now });
    return rules;
  }
}

function extractEvalTag(obs: TraceCloseObservation): string | null {
  const m = obs.trace.metadata[EVAL_TAG_ATTR];
  if (typeof m === "string") return m;
  for (const s of obs.trace.spans) {
    const v = s.attributes[EVAL_TAG_ATTR];
    if (typeof v === "string") return v;
  }
  return null;
}
