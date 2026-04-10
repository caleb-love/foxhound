import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getModelPricingOverrides } from "@foxhound/db";

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
    // Resolve relative to this file → packages/db/src/data/model-pricing.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(__dirname, "../../../packages/db/src/data/model-pricing.json");
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
 * Look up pricing for a model using longest-prefix match.
 * Org overrides take precedence (exact match only).
 * Returns null if no match found.
 */
export async function lookupPricing(
  orgId: string,
  model: string,
): Promise<{ inputCostPerToken: number; outputCostPerToken: number } | null> {
  await ensureFresh();

  // Check org overrides first (exact match)
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

  // Longest-prefix match on default pricing (already sorted by length desc)
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
