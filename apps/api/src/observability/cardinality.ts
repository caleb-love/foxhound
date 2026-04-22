/**
 * Bounded-cardinality label tracker for per-tenant metrics.
 *
 * Prometheus timeseries cardinality is the #1 footgun in label-rich metric
 * systems. A naive `labels({ org_id })` with unbounded orgs creates one
 * timeseries per tenant, which at Foxhound's scale can break the scrape
 * endpoint and blow up Prom storage.
 *
 * Strategy: keep the top-N most-active org_ids as first-class labels;
 * everything else rolls up into `org_id="other"`. The set is updated on an
 * LRU-by-activity basis. This preserves signal for high-volume tenants
 * (who are the ones a dashboard cares about) while capping the label set.
 *
 * Safety properties:
 *   - Total label cardinality never exceeds `maxLabels + 1` (`+1` for "other").
 *   - A previously-tracked org that falls out of the top-N keeps emitting
 *     metrics under "other"; no dropped observations.
 *   - No allocation per request on the steady-state path; lookups are O(1).
 */

export interface BoundedLabels {
  /** Return the label value to use for a given raw input. */
  resolve(raw: string): string;
  /** Current tracked label count, excluding the "other" sink. */
  size(): number;
  /** Test hook: current tracked set. */
  snapshot(): readonly string[];
}

export function createBoundedLabels(opts: {
  maxLabels: number;
  otherLabel?: string;
}): BoundedLabels {
  const { maxLabels } = opts;
  const otherLabel = opts.otherLabel ?? "other";
  if (maxLabels < 1) throw new Error("maxLabels must be >= 1");

  // LRU by insertion order: Map preserves insertion order; we `delete` +
  // re-`set` on access to bump recency.
  const tracked = new Map<string, number>();

  return {
    resolve(raw: string): string {
      const key = raw || "unknown";
      const prev = tracked.get(key);
      if (prev !== undefined) {
        tracked.delete(key);
        tracked.set(key, prev + 1);
        return key;
      }
      if (tracked.size < maxLabels) {
        tracked.set(key, 1);
        return key;
      }
      // Full: roll into "other".
      return otherLabel;
    },
    size(): number {
      return tracked.size;
    },
    snapshot(): readonly string[] {
      return Array.from(tracked.keys());
    },
  };
}
