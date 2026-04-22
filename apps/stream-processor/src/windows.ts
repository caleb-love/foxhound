/**
 * Bucketed rolling-window primitive (WP14).
 *
 * Stores timestamped values under a key, bucketed at `bucketMs` resolution,
 * and evicts buckets older than `windowMs` relative to a clock the caller
 * owns. Callers must inject `now` at read time — the window never reads
 * `Date.now()` itself. This keeps the primitive test-deterministic and
 * respects Pattern 9 in `docs/reference/typescript-patterns.md`
 * (time-based triggers use accumulator clocks, never data-field clocks).
 *
 * Design choices:
 *  - Buckets are `Math.floor(timestamp / bucketMs)`; out-of-range timestamps
 *    silently truncate to bucket 0. That is deliberate: the stream
 *    processor only ever calls `add` with a wall-clock `now` it just
 *    read, so out-of-range cannot happen in practice.
 *  - `values(key, now)` returns items still within the window.
 *  - `prune(now)` is called by the caller (stream processor) so eviction
 *    is driven by the tick loop, not by each write. A key whose every
 *    bucket expires is deleted from the Map so memory stays bounded.
 *  - Memory bound: a single key holds at most
 *    `ceil(windowMs / bucketMs)` buckets, each with an array of T.
 *    Per-org bounding is the caller's responsibility.
 *
 * Unit tests exercise: add+read, bucket rotation, empty-key collection,
 * out-of-window eviction, forEach, and prune-preserves-live-buckets.
 */

export interface RollingWindowOptions {
  /** Total window length in ms. Values older than `now - windowMs` are evicted. */
  readonly windowMs: number;
  /** Bucket resolution in ms. Finer buckets cost memory; coarser are cheaper. */
  readonly bucketMs: number;
}

interface Bucket<T> {
  readonly bucketIndex: number; // Math.floor(timestamp / bucketMs)
  readonly items: T[];
}

export class RollingWindow<T> {
  private readonly windowMs: number;
  private readonly bucketMs: number;
  private readonly keyed = new Map<string, Bucket<T>[]>();

  constructor(opts: RollingWindowOptions) {
    if (opts.windowMs <= 0) throw new Error("windowMs must be > 0");
    if (opts.bucketMs <= 0) throw new Error("bucketMs must be > 0");
    if (opts.bucketMs > opts.windowMs) {
      throw new Error("bucketMs must be <= windowMs");
    }
    this.windowMs = opts.windowMs;
    this.bucketMs = opts.bucketMs;
  }

  /** Append `value` under `key` at time `timestamp` (wall-clock ms). */
  add(key: string, value: T, timestamp: number): void {
    const bucketIndex = Math.floor(timestamp / this.bucketMs);
    let buckets = this.keyed.get(key);
    if (!buckets) {
      buckets = [];
      this.keyed.set(key, buckets);
    }
    const last = buckets[buckets.length - 1];
    if (last && last.bucketIndex === bucketIndex) {
      last.items.push(value);
      return;
    }
    // Append new bucket. Buckets are maintained in non-decreasing
    // bucketIndex order because callers always pass `now` monotonically.
    buckets.push({ bucketIndex, items: [value] });
  }

  /** All items for `key` whose bucket is still within `[now - windowMs, now]`. */
  values(key: string, now: number): T[] {
    const buckets = this.keyed.get(key);
    if (!buckets || buckets.length === 0) return [];
    const cutoffBucket = Math.floor((now - this.windowMs) / this.bucketMs);
    const out: T[] = [];
    for (const b of buckets) {
      if (b.bucketIndex > cutoffBucket) {
        for (const item of b.items) out.push(item);
      }
    }
    return out;
  }

  /** Iterate every key with its in-window items. Expired keys are skipped. */
  forEach(now: number, cb: (key: string, items: T[]) => void): void {
    for (const [key, buckets] of this.keyed) {
      const cutoffBucket = Math.floor((now - this.windowMs) / this.bucketMs);
      const items: T[] = [];
      for (const b of buckets) {
        if (b.bucketIndex > cutoffBucket) {
          for (const it of b.items) items.push(it);
        }
      }
      if (items.length > 0) cb(key, items);
    }
  }

  /**
   * Evict buckets older than `now - windowMs` across all keys. Keys whose
   * every bucket is expired are removed from the map. Call from the tick
   * loop, not on every write, to amortize cost.
   */
  prune(now: number): void {
    const cutoffBucket = Math.floor((now - this.windowMs) / this.bucketMs);
    for (const [key, buckets] of this.keyed) {
      // Buckets are in-order; find first live index and slice.
      let firstLive = buckets.length;
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i]!;
        if (b.bucketIndex > cutoffBucket) {
          firstLive = i;
          break;
        }
      }
      if (firstLive === buckets.length) {
        this.keyed.delete(key);
      } else if (firstLive > 0) {
        this.keyed.set(key, buckets.slice(firstLive));
      }
    }
  }

  /** Test/metrics hook: number of live keys. */
  size(): number {
    return this.keyed.size;
  }

  /** Test/metrics hook: total bucket count across all keys. */
  bucketCount(): number {
    let n = 0;
    for (const b of this.keyed.values()) n += b.length;
    return n;
  }
}
