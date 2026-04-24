import type { Trace } from "@foxhound/types";
import type { SpanTransport } from "./index.js";

export type BackpressurePolicy = "block" | "drop-oldest" | "drop-newest";

export interface BatchProcessorConfig {
  readonly transport: SpanTransport;
  readonly maxQueueSize?: number;
  readonly maxExportBatchSize?: number;
  readonly scheduleDelayMs?: number;
  readonly backpressurePolicy?: BackpressurePolicy;
  readonly onDrop?: (trace: Trace, reason: "queue-full") => void;
}

interface ResolvedConfig {
  readonly transport: SpanTransport;
  readonly maxQueueSize: number;
  readonly maxExportBatchSize: number;
  readonly scheduleDelayMs: number;
  readonly backpressurePolicy: BackpressurePolicy;
  readonly onDrop: (trace: Trace, reason: "queue-full") => void;
}

/**
 * Non-blocking trace export with a bounded in-memory queue.
 *
 * Pendo-aligned defaults are intentional for WP06:
 * - maxExportBatchSize: 512
 * - scheduleDelayMs: 2000
 *
 * JavaScript cannot safely implement a true synchronous "block until space"
 * policy without risking event-loop deadlock. The "block" policy therefore
 * forces an immediate drain before accepting the trace. If a drain is already
 * in flight, the trace is accepted and the queue may exceed maxQueueSize until
 * the in-flight export finishes. Production clients should use drop-oldest.
 */
export class BatchSpanProcessor {
  private readonly cfg: ResolvedConfig;
  private readonly queue: Trace[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private inFlight: Promise<void> | undefined;

  constructor(cfg: BatchProcessorConfig) {
    const maxQueueSize = cfg.maxQueueSize ?? 2048;
    const maxExportBatchSize = cfg.maxExportBatchSize ?? 512;
    if (maxQueueSize < 1) {
      throw new Error("maxQueueSize must be at least 1");
    }
    if (maxExportBatchSize < 1) {
      throw new Error("maxExportBatchSize must be at least 1");
    }

    this.cfg = {
      transport: cfg.transport,
      maxQueueSize,
      maxExportBatchSize,
      scheduleDelayMs: cfg.scheduleDelayMs ?? 2000,
      backpressurePolicy: cfg.backpressurePolicy ?? "drop-oldest",
      onDrop: cfg.onDrop ?? defaultOnDrop,
    };

    this.timer = setInterval(() => {
      void this.exportBatch();
    }, this.cfg.scheduleDelayMs);

    if (typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  get queueDepth(): number {
    return this.queue.length;
  }

  enqueue(trace: Trace): void {
    if (this.closed) return;

    if (this.queue.length >= this.cfg.maxQueueSize) {
      if (this.cfg.backpressurePolicy === "drop-oldest") {
        const evicted = this.queue.shift();
        if (evicted !== undefined) this.cfg.onDrop(evicted, "queue-full");
      } else if (this.cfg.backpressurePolicy === "drop-newest") {
        this.cfg.onDrop(trace, "queue-full");
        return;
      } else {
        void this.exportBatch();
      }
    }

    this.queue.push(trace);

    if (this.queue.length >= this.cfg.maxExportBatchSize) {
      void this.exportBatch();
    }
  }

  async flush(timeoutMs = 5000): Promise<boolean> {
    const deadline = Date.now() + Math.max(0, timeoutMs);

    while (this.queue.length > 0 || this.inFlight !== undefined) {
      const work = this.inFlight ?? this.exportBatch();
      if (work === undefined) break;

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) return false;

      const completed = await waitFor(work, remainingMs);
      if (!completed) return false;
    }

    return this.queue.length === 0 && this.inFlight === undefined;
  }

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

  private exportBatch(): Promise<void> | undefined {
    if (this.inFlight !== undefined) return this.inFlight;
    if (this.queue.length === 0) return undefined;

    const batch = this.queue.splice(0, this.cfg.maxExportBatchSize);
    this.inFlight = Promise.all(
      batch.map((trace) =>
        this.cfg.transport.send(trace).catch((err) => {
          console.warn(
            `[foxhound/batch-processor] export failed for trace ${trace.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }),
      ),
    )
      .then(() => undefined)
      .finally(() => {
        this.inFlight = undefined;
        if (!this.closed && this.queue.length >= this.cfg.maxExportBatchSize) {
          queueMicrotask(() => {
            void this.exportBatch();
          });
        }
      });

    return this.inFlight;
  }
}

async function waitFor(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
    if (typeof timer === "object" && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  });

  const result = await Promise.race([promise.then(() => "done" as const), timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return result === "done";
}

function defaultOnDrop(trace: Trace, reason: "queue-full"): void {
  console.warn(
    `[foxhound/batch-processor] trace ${trace.id} dropped (${reason}); ` +
      "increase maxQueueSize or reduce export rate to avoid loss.",
  );
}
