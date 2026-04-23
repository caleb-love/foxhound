/**
 * Integration tests for the WP16 versioned pricing queries.
 *
 * Runs against a real PostgreSQL database (shares `DATABASE_URL` with
 * the rest of `packages/db`'s integration tests). Skips automatically
 * when `DATABASE_URL` is not set — the execution environment defined
 * in `PROGRAM-GUARDRAILS.md` is local-only, so these tests exist
 * primarily as operator-runnable proofs for the live Postgres gate.
 *
 * The tests exercise the invariants RFC-016 calls load-bearing:
 *   - Time-window lookup honors the half-open `[from, to)` semantics.
 *   - Appending a new row atomically closes the predecessor.
 *   - Seeding is idempotent.
 *   - History is monotonic; a row with `effective_from` at or before
 *     the active row is rejected.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { testDb, hasDatabase, runMigrations, truncateAll, closeConnection } from "./test-setup.js";

// ---------------------------------------------------------------------------
// Only run when a live Postgres is configured. Program execution is local-
// only by default, so these tests skip in the agent's environment.
// ---------------------------------------------------------------------------

const runOrSkip = hasDatabase ? describe : describe.skip;

runOrSkip("db · queries-pricing (WP16)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pricing: any;

  beforeAll(async () => {
    await runMigrations();
    pricing = await import("./queries-pricing.js");
  });

  beforeEach(async () => {
    // `truncateAll()` wipes every known table (it does not take an
    // argument). That is the right shape for pricing tests too:
    // pricing-row identity resets between tests.
    await truncateAll();
  });

  afterAll(async () => {
    await closeConnection();
  });

  it("getEffectivePrice returns the row covering `at`", async () => {
    await pricing.addPriceRow({
      model: "gpt-4o",
      provider: "openai",
      inputPricePer1k: 2.0,
      outputPricePer1k: 8.0,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      createdBy: "tester",
    });
    await pricing.addPriceRow({
      model: "gpt-4o",
      provider: "openai",
      inputPricePer1k: 2.5,
      outputPricePer1k: 10.0,
      effectiveFrom: new Date("2026-03-01T00:00:00Z"),
      createdBy: "tester",
    });

    const preChange = await pricing.getEffectivePrice({
      model: "gpt-4o",
      provider: "openai",
      at: new Date("2026-02-15T00:00:00Z"),
    });
    const postChange = await pricing.getEffectivePrice({
      model: "gpt-4o",
      provider: "openai",
      at: new Date("2026-04-01T00:00:00Z"),
    });

    expect(preChange?.inputPricePer1k).toBe(2.0);
    expect(postChange?.inputPricePer1k).toBe(2.5);
  });

  it("addPriceRow closes the predecessor atomically", async () => {
    await pricing.addPriceRow({
      model: "claude-sonnet-4",
      provider: "anthropic",
      inputPricePer1k: 3.0,
      outputPricePer1k: 15.0,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      createdBy: "tester",
    });
    await pricing.addPriceRow({
      model: "claude-sonnet-4",
      provider: "anthropic",
      inputPricePer1k: 3.5,
      outputPricePer1k: 17.5,
      effectiveFrom: new Date("2026-06-01T00:00:00Z"),
      createdBy: "tester",
    });

    const history = await pricing.listPricingHistory({
      model: "claude-sonnet-4",
      provider: "anthropic",
    });
    expect(history).toHaveLength(2);
    // Newest first.
    expect(history[0].effectiveTo).toBeNull();
    expect(history[1].effectiveTo).toEqual(new Date("2026-06-01T00:00:00Z"));
  });

  it("returns null when no row covers `at`", async () => {
    await pricing.addPriceRow({
      model: "gemini-flash",
      provider: "google",
      inputPricePer1k: 0.5,
      outputPricePer1k: 1.5,
      effectiveFrom: new Date("2026-05-01T00:00:00Z"),
      createdBy: "tester",
    });

    const before = await pricing.getEffectivePrice({
      model: "gemini-flash",
      provider: "google",
      at: new Date("2026-01-01T00:00:00Z"),
    });
    expect(before).toBeNull();
  });

  it("refuses to insert a non-monotonic effectiveFrom", async () => {
    await pricing.addPriceRow({
      model: "gpt-3.5-turbo",
      provider: "openai",
      inputPricePer1k: 0.5,
      outputPricePer1k: 1.5,
      effectiveFrom: new Date("2026-03-01T00:00:00Z"),
      createdBy: "tester",
    });

    await expect(
      pricing.addPriceRow({
        model: "gpt-3.5-turbo",
        provider: "openai",
        inputPricePer1k: 0.4,
        outputPricePer1k: 1.2,
        // Deliberately earlier than the active row's effective_from.
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        createdBy: "tester",
      }),
    ).rejects.toThrow(/monotonic/);
  });

  it("seedLegacyPricing is idempotent across multiple runs", async () => {
    const rows = [
      { model: "a", provider: "p", inputPricePer1k: 1, outputPricePer1k: 2 },
      { model: "b", provider: "p", inputPricePer1k: 3, outputPricePer1k: 4 },
    ];
    const first = await pricing.seedLegacyPricing({
      rows,
      effectiveFrom: new Date(0),
      createdBy: "seed",
    });
    const second = await pricing.seedLegacyPricing({
      rows,
      effectiveFrom: new Date(0),
      createdBy: "seed",
    });

    expect(first.inserted).toBe(2);
    expect(first.skipped).toBe(0);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(2);
  });

  it("listActivePricing returns exactly the `effective_to IS NULL` rows", async () => {
    await pricing.addPriceRow({
      model: "m1",
      provider: "p",
      inputPricePer1k: 1,
      outputPricePer1k: 2,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      createdBy: "tester",
    });
    await pricing.addPriceRow({
      model: "m1",
      provider: "p",
      inputPricePer1k: 1.1,
      outputPricePer1k: 2.1,
      effectiveFrom: new Date("2026-06-01T00:00:00Z"),
      createdBy: "tester",
    });
    await pricing.addPriceRow({
      model: "m2",
      provider: "p",
      inputPricePer1k: 5,
      outputPricePer1k: 10,
      effectiveFrom: new Date("2026-02-01T00:00:00Z"),
      createdBy: "tester",
    });

    const active = await pricing.listActivePricing();
    expect(active).toHaveLength(2);
    const byModel = Object.fromEntries(
      active.map((r: { model: string; inputPricePer1k: number }) => [r.model, r.inputPricePer1k]),
    );
    expect(byModel["m1"]).toBe(1.1);
    expect(byModel["m2"]).toBe(5);
  });

  it("assertNoRetroactiveEdit succeeds on clean history", async () => {
    await pricing.addPriceRow({
      model: "m",
      provider: "p",
      inputPricePer1k: 1,
      outputPricePer1k: 2,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      createdBy: "tester",
    });
    await expect(pricing.assertNoRetroactiveEdit()).resolves.toBeUndefined();
  });
});
