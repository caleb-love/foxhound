import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getModelPricingOverrides, getEffectivePrice } from "@foxhound/db";

interface PricingEntry {
  provider: string;
  modelPattern: string;
  inputCostPerToken: number;
  outputCostPerToken: number;
}

// In-memory cache: sorted by modelPattern length desc for longest-prefix match
let defaultPricing: PricingEntry[] = [];
let orgOverrides: Map<string, PricingEntry[]> = new Map();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60_000;

function loadDefaultPricing(): PricingEntry[] {
  try {
    // Resolve relative to this file.
    //
    // Source layout: apps/api/src/lib/pricing-cache.ts → up 4 to repo
    // root → packages/db/src/data/model-pricing.json.
    // Built layout: apps/api/dist/lib/pricing-cache.js → also up 4 to
    // repo root (dist sits alongside src under apps/api, so both
    // layouts share the same ascent count).
    //
    // Pre-WP16 this was `../../../`, which resolved to
    // `apps/packages/db/…` and silently failed through the catch
    // below, leaving `defaultPricing` empty in production. WP16
    // needs the JSON fallback working so unknown models still
    // produce cost numbers on a fresh cluster with no seeded
    // `pricing_rows` history.
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(__dirname, "../../../../packages/db/src/data/model-pricing.json");
    const raw = readFileSync(filePath, "utf-8");
    const entries = JSON.parse(raw) as PricingEntry[];
    return entries.sort((a, b) => b.modelPattern.length - a.modelPattern.length);
  } catch {
    console.warn("[pricing-cache] Failed to load default pricing JSON");
    return [];
  }
}

export async function refreshPricingCache(): Promise<void> {
  defaultPricing = loadDefaultPricing();
  // Load all org overrides (small table)
  const overrides = await getModelPricingOverrides();
  orgOverrides = new Map();
  for (const o of overrides) {
    const list = orgOverrides.get(o.orgId) ?? [];
    list.push({
      provider: o.provider,
      modelPattern: o.modelPattern,
      inputCostPerToken: Number(o.inputCostPerToken),
      outputCostPerToken: Number(o.outputCostPerToken),
    });
    orgOverrides.set(o.orgId, list);
  }
  lastRefresh = Date.now();
}

async function ensureFresh(): Promise<void> {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshPricingCache();
  }
}

/**
 * Look up pricing for a model at a given timestamp.
 *
 * Fallback order (WP16):
 *   1. Per-org override (exact-model match) — immediate.
 *   2. Versioned `pricing_rows` time-series whose `[effective_from,
 *      effective_to)` contains `at`. The consumer is expected to pass
 *      `at = span.startTime`; legacy callers that omit `at` get `now()`,
 *      which is the pre-WP16 semantics.
 *   3. Longest-prefix match against the committed default pricing JSON.
 *
 * Returns `null` if no match exists. The JSON fallback is preserved so
 * the system continues to produce cost numbers even before an operator
 * runs `seedLegacyPricing` against a live Postgres.
 */
export async function lookupPricing(
  orgId: string,
  model: string,
  at?: Date,
): Promise<{ inputCostPerToken: number; outputCostPerToken: number } | null> {
  await ensureFresh();

  // 1. Per-org override (exact match) — not time-versioned yet; that is a
  // named WP16 followup ("customer custom pricing"). For now, org
  // overrides represent the customer's current truth.
  const overrides = orgOverrides.get(orgId);
  if (overrides) {
    const exactMatch = overrides.find((e) => model === e.modelPattern);
    if (exactMatch) {
      return {
        inputCostPerToken: exactMatch.inputCostPerToken,
        outputCostPerToken: exactMatch.outputCostPerToken,
      };
    }
  }

  // 2. WP16 time-series lookup. We probe `pricing_rows` for an exact
  // model match at the supplied timestamp. Provider inference: if the
  // model string is `provider/model`, split; otherwise fall through to
  // the JSON fallback, which carries provider explicitly.
  const lookupAt = at ?? new Date();
  const parts = model.split("/");
  const providerHint = parts.length === 2 ? parts[0]! : undefined;
  const modelId = parts.length === 2 ? parts[1]! : model;
  try {
    if (providerHint !== undefined) {
      const row = await getEffectivePrice({
        model: modelId,
        provider: providerHint,
        at: lookupAt,
      });
      if (row) {
        return {
          // Convert USD-per-1k-tokens (WP16 storage) to USD-per-token
          // (existing API contract). Division is exact for the
          // precision we store.
          inputCostPerToken: row.inputPricePer1k / 1000,
          outputCostPerToken: row.outputPricePer1k / 1000,
        };
      }
    }
  } catch (err) {
    // Fail open to the JSON fallback if Postgres is unreachable. Cost
    // accuracy degrades to "current truth" rather than becoming zero,
    // which is the right tradeoff for telemetry: dashboards keep
    // working, and the next refresh restores correctness.
    console.warn("[pricing-cache] time-series lookup failed, falling back to JSON", err);
  }

  // 3. Longest-prefix match on the committed JSON pricing table.
  for (const entry of defaultPricing) {
    if (model.startsWith(entry.modelPattern)) {
      return {
        inputCostPerToken: entry.inputCostPerToken,
        outputCostPerToken: entry.outputCostPerToken,
      };
    }
  }

  return null;
}
