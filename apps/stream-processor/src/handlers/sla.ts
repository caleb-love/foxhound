/**
 * SLA handler (WP14).
 *
 * Maintains per-agent rolling windows of trace duration and error count;
 * fires `sla_duration_breach` when window p95 exceeds `maxDurationMs` and
 * `sla_success_rate_breach` when window success-rate falls below
 * `minSuccessRate`, provided the sample-size floor is met.
 *
 * Firing discipline:
 *   - One breach fires at most once per `dedupeWindowMs` per (agentId, type)
 *     so a sustained breach does not spam the channel. The dedupe key is
 *     an in-memory `lastFiredMs` map; stream processor restarts reset it,
 *     which is acceptable because the watchdog interval is 60s.
 *   - The handler does not recompute on every span; duration/error are
 *     appended on `onTraceClose` only. Individual spans are ignored.
 *
 * State bound: at most O(agents × buckets). Agents with no traffic get
 * pruned on tick.
 */

import type { AlertEvent } from "@foxhound/notifications";
import { RollingWindow } from "../windows.js";
import {
  type AlertEmitter,
  type DataAccess,
  type SpanHandler,
  type SpanObservation,
  type TraceCloseObservation,
  spanDurationMs,
  spanIsError,
} from "./types.js";

export interface SlaHandlerOptions {
  readonly data: DataAccess;
  readonly emitter: AlertEmitter;
  /** Default evaluation window if the agent config does not specify one. */
  readonly defaultWindowMs?: number;
  /** Default min sample size if the agent config does not specify one. */
  readonly defaultMinSampleSize?: number;
  /** Bucket resolution for the rolling window. */
  readonly bucketMs?: number;
  /** Dedupe window per (agent, breach-type). */
  readonly dedupeWindowMs?: number;
  /** Test hook: optional clock override. */
  readonly now?: () => number;
}

interface TraceSample {
  readonly durationMs: number;
  readonly isError: boolean;
  readonly observedMs: number;
}

const DEFAULTS = {
  defaultWindowMs: 5 * 60_000, // 5 min
  defaultMinSampleSize: 10,
  bucketMs: 10_000, // 10 s
  dedupeWindowMs: 5 * 60_000, // 5 min
};

export class SlaHandler implements SpanHandler {
  readonly name = "sla";
  private readonly window: RollingWindow<TraceSample>;
  private readonly lastFired = new Map<string, number>();
  private readonly opts: Required<Omit<SlaHandlerOptions, "data" | "emitter" | "now">> & {
    readonly data: DataAccess;
    readonly emitter: AlertEmitter;
    readonly now: () => number;
  };

  constructor(opts: SlaHandlerOptions) {
    this.opts = {
      data: opts.data,
      emitter: opts.emitter,
      defaultWindowMs: opts.defaultWindowMs ?? DEFAULTS.defaultWindowMs,
      defaultMinSampleSize: opts.defaultMinSampleSize ?? DEFAULTS.defaultMinSampleSize,
      bucketMs: opts.bucketMs ?? DEFAULTS.bucketMs,
      dedupeWindowMs: opts.dedupeWindowMs ?? DEFAULTS.dedupeWindowMs,
      now: opts.now ?? Date.now,
    };
    this.window = new RollingWindow<TraceSample>({
      windowMs: this.opts.defaultWindowMs,
      bucketMs: this.opts.bucketMs,
    });
  }

  onSpan(_obs: SpanObservation): void {
    /* no-op; SLA samples trace-level, not span-level. */
  }

  async onTraceClose(obs: TraceCloseObservation): Promise<void> {
    const config = await this.opts.data.getAgentConfig(obs.orgId, obs.agentId);
    if (!config) return;
    if (config.maxDurationMs === null && config.minSuccessRate === null) return;

    const duration = traceDurationMs(obs);
    const isError = traceIsError(obs);
    const key = keyFor(obs.orgId, obs.agentId);
    this.window.add(
      key,
      { durationMs: duration, isError, observedMs: obs.observedMs },
      obs.observedMs,
    );

    const samples = this.window.values(key, this.opts.now());
    const minSamples = config.minSampleSize ?? this.opts.defaultMinSampleSize;
    if (samples.length < minSamples) return;

    if (config.maxDurationMs !== null) {
      const p95 = percentile(
        samples.map((s) => s.durationMs),
        0.95,
      );
      if (p95 > config.maxDurationMs) {
        await this.maybeFire("sla_duration_breach", obs, {
          durationP95Ms: p95,
          threshold: config.maxDurationMs,
          sampleSize: samples.length,
        });
      }
    }

    if (config.minSuccessRate !== null) {
      const errors = samples.filter((s) => s.isError).length;
      const rate = samples.length === 0 ? 1 : 1 - errors / samples.length;
      if (rate < config.minSuccessRate) {
        await this.maybeFire("sla_success_rate_breach", obs, {
          successRate: rate,
          threshold: config.minSuccessRate,
          sampleSize: samples.length,
        });
      }
    }
  }

  onTick(now: number): void {
    this.window.prune(now);
    // Drop stale dedupe entries.
    for (const [k, t] of this.lastFired) {
      if (now - t > this.opts.dedupeWindowMs) this.lastFired.delete(k);
    }
  }

  private async maybeFire(
    type: "sla_duration_breach" | "sla_success_rate_breach",
    obs: TraceCloseObservation,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const dedupeKey = `${obs.orgId}::${obs.agentId}::${type}`;
    const last = this.lastFired.get(dedupeKey) ?? 0;
    const now = this.opts.now();
    if (now - last < this.opts.dedupeWindowMs) return;
    this.lastFired.set(dedupeKey, now);

    const event: AlertEvent = {
      type,
      severity: "high",
      orgId: obs.orgId,
      agentId: obs.agentId,
      traceId: obs.traceId,
      message: messageFor(type, obs.agentId, meta),
      metadata: meta,
      occurredAt: new Date(now),
    };
    await this.opts.emitter.emit(event);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

function keyFor(orgId: string, agentId: string): string {
  return `${orgId}::${agentId}`;
}

function traceDurationMs(obs: TraceCloseObservation): number {
  const { trace } = obs;
  const end = trace.endTimeMs ?? trace.startTimeMs;
  const d = end - trace.startTimeMs;
  if (d > 0) return d;
  // Fall back to max span duration if trace boundaries are malformed.
  let max = 0;
  for (const s of trace.spans) {
    const sd = spanDurationMs(s);
    if (sd > max) max = sd;
  }
  return max;
}

function traceIsError(obs: TraceCloseObservation): boolean {
  return obs.trace.spans.some(spanIsError);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const loVal = sorted[low]!;
  const hiVal = sorted[high]!;
  if (low === high) return loVal;
  const frac = rank - low;
  return loVal + (hiVal - loVal) * frac;
}

function messageFor(
  type: "sla_duration_breach" | "sla_success_rate_breach",
  agentId: string,
  meta: Record<string, unknown>,
): string {
  if (type === "sla_duration_breach") {
    return `Agent "${agentId}" p95 duration ${meta["durationP95Ms"]}ms exceeds SLA ${meta["threshold"]}ms (${meta["sampleSize"]} traces).`;
  }
  const rate = Number(meta["successRate"] ?? 0);
  const threshold = Number(meta["threshold"] ?? 0);
  return `Agent "${agentId}" success rate ${(rate * 100).toFixed(1)}% below SLA ${(threshold * 100).toFixed(1)}% (${meta["sampleSize"]} traces).`;
}
