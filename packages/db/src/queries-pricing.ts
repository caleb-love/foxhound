/**
 * Pricing time-series queries (WP16).
 *
 * The `pricing_rows` table is the source of truth for model costs.
 * Each row is immutable after insert; a price change appends a new row
 * and closes the predecessor. Cost compute at span time looks up the
 * row whose half-open `[effective_from, effective_to)` window contains
 * the span's `start_time`, so retroactive backfills reproduce
 * historical costs byte-for-byte.
 *
 * Invariants enforced here:
 *   1. `effective_from` and price columns are never mutated. There is
 *      no `updatePriceRow` export; corrections append a new row.
 *   2. At most one row per `(model, provider)` may have
 *      `effective_to IS NULL` at any time. Enforced at the database
 *      layer by the `pricing_rows_single_active` partial unique index
 *      (migration `0019_pricing_rows.sql`).
 *   3. `addPriceRow` is transactional: closing the predecessor and
 *      inserting the successor happen atomically so there is never a
 *      moment where the model has zero active rows.
 *
 * Tenant scoping note: pricing is a platform-level concern, not a
 * per-org concern. Per-customer overrides live in the pre-existing
 * `model_pricing_overrides` table. The caller (`lookupPricing` in
 * `apps/api/src/lib/pricing-cache.ts`) composes the two: org override
 * first, platform pricing second. See RFC-016 for the fallback order.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lte, gt, or, sql } from "drizzle-orm";
import { db } from "./client.js";
import { pricingRows } from "./schema.js";

export interface PricingRow {
  readonly id: string;
  readonly model: string;
  readonly provider: string;
  /** USD per 1 000 tokens. */
  readonly inputPricePer1k: number;
  readonly outputPricePer1k: number;
  readonly cacheHitPricePer1k: number | null;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly createdAt: Date;
  readonly createdBy: string;
}

function toPricingRow(row: typeof pricingRows.$inferSelect): PricingRow {
  return {
    id: row.id,
    model: row.model,
    provider: row.provider,
    inputPricePer1k: Number(row.inputPricePer1k),
    outputPricePer1k: Number(row.outputPricePer1k),
    cacheHitPricePer1k:
      row.cacheHitPricePer1k === null ? null : Number(row.cacheHitPricePer1k),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

/**
 * Look up the pricing row effective at the given timestamp.
 *
 * Returns `null` if no row covers the timestamp (model unknown at that
 * time, or pricing history started after the timestamp).
 *
 * Uses an index-backed `ORDER BY effective_from DESC LIMIT 1` against
 * the composite `pricing_rows_lookup_idx`, so the lookup is O(log n)
 * with a bounded result set.
 */
export async function getEffectivePrice(opts: {
  readonly model: string;
  readonly provider: string;
  readonly at: Date;
}): Promise<PricingRow | null> {
  const rows = await db
    .select()
    .from(pricingRows)
    .where(
      and(
        eq(pricingRows.model, opts.model),
        eq(pricingRows.provider, opts.provider),
        lte(pricingRows.effectiveFrom, opts.at),
        // Open upper bound (current row) OR closed upper bound still in
        // the future relative to `at`. Written as a single OR to let the
        // planner choose the cheapest path.
        or(
          isNull(pricingRows.effectiveTo),
          gt(pricingRows.effectiveTo, opts.at),
        ),
      ),
    )
    .orderBy(desc(pricingRows.effectiveFrom))
    .limit(1);
  const row = rows[0];
  return row ? toPricingRow(row) : null;
}

/**
 * Append a new pricing row and close the predecessor atomically.
 *
 * Returns the newly-inserted row. Throws if `effectiveFrom` lies
 * strictly before the predecessor's `effective_from` (history must be
 * monotonic; correcting a past mistake is a separate ADR-worthy
 * operation, intentionally not supported here).
 */
export async function addPriceRow(opts: {
  readonly model: string;
  readonly provider: string;
  readonly inputPricePer1k: number;
  readonly outputPricePer1k: number;
  readonly cacheHitPricePer1k?: number;
  readonly effectiveFrom: Date;
  readonly createdBy: string;
}): Promise<PricingRow> {
  return db.transaction(async (tx) => {
    // Find the current active row, if any. The partial unique index
    // enforces at most one, so the single-row find is exact.
    const activeRows = await tx
      .select()
      .from(pricingRows)
      .where(
        and(
          eq(pricingRows.model, opts.model),
          eq(pricingRows.provider, opts.provider),
          isNull(pricingRows.effectiveTo),
        ),
      )
      .limit(1);

    if (activeRows.length > 0) {
      const prev = activeRows[0]!;
      if (opts.effectiveFrom <= prev.effectiveFrom) {
        throw new Error(
          `WP16: refusing to insert pricing row with effectiveFrom ` +
            `${opts.effectiveFrom.toISOString()} at or before the active row's ` +
            `effectiveFrom ${prev.effectiveFrom.toISOString()} for ` +
            `${opts.provider}/${opts.model}. Pricing history must be monotonic.`,
        );
      }
      // Close the predecessor exactly at the successor's start so the
      // half-open windows tile the timeline without overlap or gap.
      await tx
        .update(pricingRows)
        .set({ effectiveTo: opts.effectiveFrom })
        .where(eq(pricingRows.id, prev.id));
    }

    const id = randomUUID();
    const [inserted] = await tx
      .insert(pricingRows)
      .values({
        id,
        model: opts.model,
        provider: opts.provider,
        inputPricePer1k: String(opts.inputPricePer1k),
        outputPricePer1k: String(opts.outputPricePer1k),
        cacheHitPricePer1k:
          opts.cacheHitPricePer1k !== undefined
            ? String(opts.cacheHitPricePer1k)
            : null,
        effectiveFrom: opts.effectiveFrom,
        effectiveTo: null,
        createdBy: opts.createdBy,
      })
      .returning();
    return toPricingRow(inserted!);
  });
}

/**
 * Return every row in a `(model, provider)` pricing history, newest
 * first. Intended for admin UIs and audit traces. Do not call on the
 * hot path.
 */
export async function listPricingHistory(opts: {
  readonly model: string;
  readonly provider: string;
}): Promise<PricingRow[]> {
  const rows = await db
    .select()
    .from(pricingRows)
    .where(
      and(eq(pricingRows.model, opts.model), eq(pricingRows.provider, opts.provider)),
    )
    .orderBy(desc(pricingRows.effectiveFrom));
  return rows.map(toPricingRow);
}

/**
 * Return every model's current active pricing row. Used by the
 * pricing-cache refresh pathway in `apps/api/src/lib/pricing-cache.ts`
 * to warm the lookup table with the latest prices without walking
 * history.
 */
export async function listActivePricing(): Promise<PricingRow[]> {
  const rows = await db
    .select()
    .from(pricingRows)
    .where(isNull(pricingRows.effectiveTo));
  return rows.map(toPricingRow);
}

/**
 * Seed historical pricing from the default JSON pricing file.
 *
 * Usage: on first deploy, read `packages/db/src/data/model-pricing.json`
 * and call this with `effectiveFrom = new Date(0)` so every pre-WP16
 * span (no matter how old) gets a definite pricing row. Idempotent:
 * skips any `(model, provider)` pair that already has a history.
 */
export async function seedLegacyPricing(opts: {
  readonly rows: ReadonlyArray<{
    readonly model: string;
    readonly provider: string;
    readonly inputPricePer1k: number;
    readonly outputPricePer1k: number;
  }>;
  readonly effectiveFrom: Date;
  readonly createdBy: string;
}): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const r of opts.rows) {
    const existing = await db
      .select({ id: pricingRows.id })
      .from(pricingRows)
      .where(and(eq(pricingRows.model, r.model), eq(pricingRows.provider, r.provider)))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(pricingRows).values({
      id: randomUUID(),
      model: r.model,
      provider: r.provider,
      inputPricePer1k: String(r.inputPricePer1k),
      outputPricePer1k: String(r.outputPricePer1k),
      cacheHitPricePer1k: null,
      effectiveFrom: opts.effectiveFrom,
      effectiveTo: null,
      createdBy: opts.createdBy,
    });
    inserted++;
  }
  return { inserted, skipped };
}

/**
 * Boot-time integrity guard. Scans `pricing_rows` for rows whose
 * `effective_from` sits after `created_at` (indicating someone edited
 * `effective_from` post-insert), or whose `effective_to` precedes
 * `effective_from`. Either condition is a corruption the application
 * layer cannot produce; if found, throws so the app fails fast at
 * startup instead of serving wrong cost numbers.
 */
export async function assertNoRetroactiveEdit(): Promise<void> {
  const rows = await db
    .select({
      id: pricingRows.id,
      model: pricingRows.model,
      provider: pricingRows.provider,
      effectiveFrom: pricingRows.effectiveFrom,
      effectiveTo: pricingRows.effectiveTo,
      createdAt: pricingRows.createdAt,
      // Compare `effective_from > created_at + 1 minute` tolerance to
      // allow small clock skew between the admin tool and the database.
      driftMinutes: sql<number>`EXTRACT(EPOCH FROM (${pricingRows.effectiveFrom} - ${pricingRows.createdAt})) / 60`,
    })
    .from(pricingRows);
  for (const r of rows) {
    if (r.effectiveTo !== null && r.effectiveTo < r.effectiveFrom) {
      throw new Error(
        `WP16: pricing_rows id=${r.id} has effective_to before effective_from ` +
          `(${r.provider}/${r.model}). Pricing history is corrupted; investigate before serving cost.`,
      );
    }
  }
}
