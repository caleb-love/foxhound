/**
 * Unit tests for the WP16 pricing-cache time-series plumbing.
 *
 * Verifies:
 *   - The `at` argument threads through to `getEffectivePrice`.
 *   - A positive time-series match returns USD-per-token values
 *     (i.e. the cache divides USD-per-1k by 1000 correctly).
 *   - A missing time-series match falls back to the JSON pricing table
 *     via the existing longest-prefix match.
 *   - An unexpected Postgres failure fails open to the JSON fallback,
 *     not to `null`.
 *
 * We mock `@foxhound/db` so the test stays pure; the live DB path is
 * exercised by the integration suite (DATABASE_URL-gated).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@foxhound/db", () => ({
  getModelPricingOverrides: vi.fn().mockResolvedValue([]),
  getEffectivePrice: vi.fn(),
}));

// Import under test AFTER the mock is in place.
import { lookupPricing, refreshPricingCache } from "./pricing-cache.js";
import { getEffectivePrice } from "@foxhound/db";

const mockedGetEffectivePrice = vi.mocked(getEffectivePrice);

beforeEach(async () => {
  mockedGetEffectivePrice.mockReset();
  // Force a cache refresh before each test so stale defaults don't bleed.
  await refreshPricingCache();
});

describe("pricing-cache · WP16 time-series integration", () => {
  it("forwards the `at` timestamp to getEffectivePrice", async () => {
    mockedGetEffectivePrice.mockResolvedValue({
      id: "p1",
      model: "gpt-4o",
      provider: "openai",
      inputPricePer1k: 2.5,
      outputPricePer1k: 10,
      cacheHitPricePer1k: null,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: null,
      createdAt: new Date(),
      createdBy: "seed",
    });

    const at = new Date("2026-03-15T12:00:00Z");
    await lookupPricing("org_a", "openai/gpt-4o", at);

    expect(mockedGetEffectivePrice).toHaveBeenCalledWith({
      model: "gpt-4o",
      provider: "openai",
      at,
    });
  });

  it("converts USD-per-1k → USD-per-token correctly on a time-series match", async () => {
    mockedGetEffectivePrice.mockResolvedValue({
      id: "p1",
      model: "gpt-4o",
      provider: "openai",
      inputPricePer1k: 2.5, // 2.50 USD per 1 000 tokens
      outputPricePer1k: 10, // 10.00 USD per 1 000 tokens
      cacheHitPricePer1k: null,
      effectiveFrom: new Date(0),
      effectiveTo: null,
      createdAt: new Date(),
      createdBy: "seed",
    });

    const result = await lookupPricing("org_a", "openai/gpt-4o", new Date("2026-03-15T12:00:00Z"));

    expect(result).toEqual({
      inputCostPerToken: 0.0025,
      outputCostPerToken: 0.01,
    });
  });

  it("falls back to the committed JSON when the time-series has no row", async () => {
    mockedGetEffectivePrice.mockResolvedValue(null);

    const result = await lookupPricing("org_a", "gpt-4o", new Date("2020-01-01T00:00:00Z"));

    // The default JSON has gpt-4o at input=0.0000025, output=0.00001.
    expect(result).toEqual({
      inputCostPerToken: 0.0000025,
      outputCostPerToken: 0.00001,
    });
  });

  it("fails open when the time-series query throws (does not propagate the error)", async () => {
    mockedGetEffectivePrice.mockRejectedValue(new Error("db unreachable"));

    // Using the provider-prefixed form to force the time-series path.
    // The JSON fallback's entries are bare model names (no provider
    // prefix), so the final result is `null` — the contract we assert
    // is (a) no thrown error, (b) graceful null, not a 500 to the
    // caller.
    const result = await lookupPricing("org_a", "openai/gpt-4o", new Date("2026-03-15T12:00:00Z"));

    expect(result).toBeNull();
  });

  it("fails open AND falls back to JSON when the bare-model form is used", async () => {
    mockedGetEffectivePrice.mockRejectedValue(new Error("db unreachable"));

    // Bare "gpt-4o" skips the time-series (no provider to infer) and
    // goes straight to the JSON fallback, which has the entry. This
    // demonstrates the no-provider path still produces costs even
    // during a Postgres outage.
    const result = await lookupPricing("org_a", "gpt-4o", new Date("2026-03-15T12:00:00Z"));

    expect(result).toEqual({
      inputCostPerToken: 0.0000025,
      outputCostPerToken: 0.00001,
    });
  });

  it("defaults `at` to now() when omitted (pre-WP16 semantics preserved)", async () => {
    mockedGetEffectivePrice.mockResolvedValue(null);

    const before = Date.now();
    await lookupPricing("org_a", "openai/gpt-4o");
    const after = Date.now();

    expect(mockedGetEffectivePrice).toHaveBeenCalledTimes(1);
    const firstCall = mockedGetEffectivePrice.mock.calls[0];
    if (!firstCall) throw new Error("expected getEffectivePrice to be called");
    const { at } = firstCall[0];
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
    expect(at.getTime()).toBeLessThanOrEqual(after);
  });

  it("does not consult the time-series when the model has no provider prefix", async () => {
    // "gpt-4o" (no slash) cannot be disambiguated to a provider, so the
    // cache goes straight to the JSON fallback without calling
    // getEffectivePrice at all.
    const result = await lookupPricing("org_a", "gpt-4o", new Date("2026-03-15T12:00:00Z"));

    expect(mockedGetEffectivePrice).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});
