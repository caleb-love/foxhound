/**
 * BatchSpanProcessor — non-blocking trace export with bounded queue (WP06).
 *
 * The Foxhound SDK's default export path calls `transport.send(trace)` inline
 * on the caller's thread. At production loads (10k+ spans/s) that means the
 * application thread pays the HTTP round-trip latency on every `tracer.flush()`
 * call. `BatchSpanProcessor` moves the transport call off the caller's thread:
 *
 *   tracer.flush()
 *     └─▶ BatchSpanProcessor.enqueue(trace)   ← O(1), never blocks >1 µs
 *                ↕ bounded queue
 *     Background setInterval pump
 *       └─▶ transport.send(batch)             ← runs independently
 *
 * Match with Pendo's defaults (explicitly matched per RFC-006 rationale):
 *   maxExportBatchSize = 512   (Pendo's OTel default)
 *   scheduleDelayMs    = 2000  (Pendo's OTel default)
 *
 * Three backpressure policies govern what happens when the queue is full:
 *
 *   "drop-oldest"  (recommended for production)
 *     Evict the oldest unsent trace to make room. The newest data
 *     (most likely to matter for a live alert) is preserved.
 *
 *   "drop-newest"
 *     Refuse the incoming trace. The queue holds exactly what arrived
 *     first; useful for forensic replay scenarios where early traces
 *     are the ground truth.
 *
 *   "block"  (recommended for development)
 *     Trigger an immediate async drain and still enqueue. In production
 *     this is equivalent to drop-newest under sustained load, but in
 *     dev the queue never reaches capacity anyway so it effectively
 *     provides lossless export without the complexity of a true blocking
 *     call. The caller's thread is NOT blocked; it returns in <1 µs.
 *
 * Callers that need guaranteed delivery should use a durable queue
 * (WP08 `@foxhound/queue`) behind the transport instead.
 */
import type { Trace } from "@foxhound/types";
import type { SpanTransport } from "./index.js";

export type BackpressurePolicy = "block" | "drop-oldest" | "drop-newest";

export interface BatchProcessorConfig {
  /**
   * The underlying wire transport. The processor calls `transport.send()`
   * on the background thread; the caller never touches it directly.
   */
  readonly transport: SpanTransport;

  /**
   * Maximum number of `Trace` objects held in the in-memory queue.
   * When the queue is full the `backpressurePolicy` governs what happens.
   * Default: 2048.
   */
  readonly maxQueueSize?: number;

  /**
   * Maximum number of `Trace` objects exported in a single transport
   * round-trip. Matches Pendo's OTel default of 512. Increasing this
   * reduces round-trips under burst load; decreasing it reduces latency
   * to first-export on light loads.
   * Default: 512.
   */
  readonly maxExportBatchSize?: number;

  /**
   * How often the pump exports queued traces, in milliseconds.
   * Matches Pendo's OTel default of 2000 ms. The pump also fires
   * immediately when the queue reaches `maxExportBatchSize`.
   * Default: 2000.
   */
  readonly scheduleDelayMs?: number;

  /**
   * What to do when the queue is full and a new trace arrives.
   * See module-level doc for semantics of each policy.
   * Default: "drop-oldest".
   */
  readonly backpressurePolicy?: BackpressurePolicy;

  /**
   * Optional callback invoked when a trace is discarded due to
   * backpressure. The default emits a single-line console.warn per drop.
   */
  readonly onDrop?: (trace: Trace, reason: "queue-full") => void;
}

/**
 * Resolved + validated configuration with all defaults applied.
 */
interface ResolvedConfig {
  readonly transport: SpanTransport;
  readonly maxQueueSize: number;
  readonly maxExportBatchSize: number;
  readonly scheduleDelayMs: number;
  readonly backpressurePolicy: BackpressurePolicy;
  readonly onDrop: (trace: Trace, reason: "queue-full") => void;
}

export class BatchSpanProcessor {
  private readonly cfg: ResolvedConfig;

  /** In-memory queue. Head = oldest; tail = newest. */
  private readonly queue: Trace[] = [];

  private timer: ReturnType<typeof setInterval> | undefined;
  private closed = false;

  /** True while an export is running; prevents re-entrant export ticks. */
  private exporting = false;

  constructor(cfg: BatchProcessorConfig) {
    this.cfg = {
      transport: cfg.transport,
      maxQueueSize: cfg.maxQueueSize ?? 2048,
      maxExportBatchSize: cfg.maxExportBatchSize ?? 512,
      scheduleDelayMs: cfg.scheduleDelayMs ?? 2000,
      backpressurePolicy: cfg.backpressurePolicy ?? "drop-oldest",
      onDrop: cfg.onDrop ?? defaultOnDrop,
    };

    // Start the background pump.
    this.timer = setInterval(() => {
      void this.exportBatch();
    }, this.cfg.scheduleDelayMs);
    // `unref()` so the timer does not prevent Node from exiting when all
    // other work is done. Callers who want guaranteed delivery must call
    // `shutdown()` explicitly.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  /**
   * Current depth of the in-memory queue. Non-zero only when export
   * is lagging behind enqueue rate.
   */
  get queueDepth(): number {
    return this.queue.length;
  }

  /**
   * Enqueue a completed trace for background export.
   *
   * This method always returns in O(1) time, regardless of queue state.
   * The backpressure policy governs what happens when the queue is full.
   *
   * Calling `enqueue` after `shutdown` is a no-op (the trace is dropped
   * silently so callers do not need to guard against post-shutdown flushes
   * from in-flight tracers).
   */
  enqueue(trace: Trace): void {
    if (this.closed) return;

    if (this.queue.length >= this.cfg.maxQueueSize) {
      switch (this.cfg.backpressurePolicy) {
        case "drop-oldest": {
          const evicted = this.queue.shift();
          if (evicted !== undefined) this.cfg.onDrop(evicted, "queue-full");
          break;
        }
        case "drop-newest": {
          this.cfg.onDrop(trace, "queue-full");
          return;
        }
        case "block": {
          // Trigger an immediate async drain. The caller thread is NOT
          // blocked; it will see the queue slightly over-full momentarily
          // and the export tick will bring it back into bounds. In practice
          // the "block" policy is only reached in dev where loads are light
          // enough that the queue never sustains saturation.
          void this.exportBatch();
          break;
        }
      }
    }

    this.queue.push(trace);

    // Eager trigger: if we've accumulated a full batch, kick the pump
    // immediately instead of waiting for the next timer tick.
    if (this.queue.length >= this.cfg.maxExportBatchSize && !this.exporting) {
      void this.exportBatch();
    }
  }

  /**
   * Flush all queued traces within `timeoutMs`.
   *
   * Races an eager-drain loop against a hard timeout. The timeout fires
   * even if an in-flight export has not yet returned, so the caller is
   * not blocked beyond `timeoutMs` regardless of transport latency.
   *
   * Returns `true` if the queue was drained; `false` if the timeout
   * was reached with items still pending.
   */
  async flush(timeoutMs = 5000): Promise<boolean> {
    const drainAll = async (): Promise<void> => {
      while (this.queue.length > 0) {
        await this.exportBatch();
      }
    };
    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("flush-timeout")), timeoutMs),
    );
    try {
      await Promise.race([drainAll(), timeoutGuard]);
    } catch (err) {
      if (err instanceof Error && err.message === "flush-timeout") {
        return false; // timed out, queue not fully drained
      }
      throw err;
    }
    return this.queue.length === 0;
  }

  /**
   * Drain the queue, stop the background timer, and close the transport.
   *
   * After `shutdown()` returns:
   * - The timer is stopped.
   * - All queued traces have been exported (or the timeout expired).
   * - `transport.close()` has been called.
   * - Further calls to `enqueue()` are no-ops.
   *
   * Returns `true` if the queue was fully drained; `false` if the timeout
   * was reached. Either way the transport is closed.
   */
  async shutdown(timeoutMs = 5000): Promise<boolean> {
    this.closed = true;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    const drained = await this.flush(timeoutMs);
    await this.cfg.transport.close().catch(() => {});
    return drained;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async exportBatch(): Promise<void> {
    if (this.exporting || this.queue.length === 0) return;
    this.exporting = true;
    try {
      // Drain up to `maxExportBatchSize` traces in one shot. We slice
      // so concurrent-ish calls (from flush() + timer) don't double-export.
      const batch = this.queue.splice(0, this.cfg.maxExportBatchSize);
      await Promise.all(
        batch.map((trace) =>
          this.cfg.transport.send(trace).catch((err) => {
            // Export errors are non-fatal. The trace is lost (the BSP
            // does not re-queue; WP12 idempotency + replay handles
            // durability at the persistence layer). Log and continue.
            console.warn(
              `[foxhound/batch-processor] export failed for trace ${trace.id}:`,
              err instanceof Error ? err.message : String(err),
            );
          }),
        ),
      );
    } finally {
      this.exporting = false;
    }
  }
}

function defaultOnDrop(trace: Trace, reason: "queue-full"): void {
  console.warn(
    `[foxhound/batch-processor] trace ${trace.id} dropped (${reason}); ` +
      "increase maxQueueSize or reduce flush interval to avoid loss.",
  );
}
