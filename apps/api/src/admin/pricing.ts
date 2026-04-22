/**
 * Admin pricing tool (WP16).
 *
 * Two surfaces:
 *
 *   1. Programmatic API — imported by ops scripts or a future admin UI.
 *      `addPricing({...})` appends a new row and closes the predecessor
 *      atomically; `listHistory({...})` returns the full per-model
 *      history newest-first; `listActive()` returns the currently-
 *      effective row for every model.
 *
 *   2. CLI entry point — when the file is run directly it parses argv
 *      and dispatches. Intended invocation:
 *
 *        node apps/api/dist/admin/pricing.js add \
 *          --model gpt-4o \
 *          --provider openai \
 *          --input-per-1k 0.0025 \
 *          --output-per-1k 0.01 \
 *          --effective-from 2026-05-01T00:00:00Z \
 *          --created-by caleb
 *
 *        node apps/api/dist/admin/pricing.js list --model gpt-4o --provider openai
 *
 *        node apps/api/dist/admin/pricing.js active
 *
 *        node apps/api/dist/admin/pricing.js seed
 *          (reads packages/db/src/data/model-pricing.json and backfills
 *           any (model, provider) pair missing a pricing_rows history,
 *           effective from epoch-0)
 *
 * Security: the CLI refuses to run without FOXHOUND_ADMIN=1 in the
 * environment. That is not a production auth layer; it is a last-mile
 * guardrail against fat-fingered invocations. Production use should go
 * through the planned admin API surface (WP18 auth).
 *
 * Tenancy: pricing is platform-level. There is no orgId param. Per-
 * customer overrides continue to live in `model_pricing_overrides`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  addPriceRow,
  listPricingHistory,
  listActivePricing,
  seedLegacyPricing,
  type PricingRow,
} from "@foxhound/db";

export interface AddPricingArgs {
  readonly model: string;
  readonly provider: string;
  readonly inputPricePer1k: number;
  readonly outputPricePer1k: number;
  readonly cacheHitPricePer1k?: number;
  readonly effectiveFrom: Date;
  readonly createdBy: string;
}

export async function addPricing(args: AddPricingArgs): Promise<PricingRow> {
  return addPriceRow({
    model: args.model,
    provider: args.provider,
    inputPricePer1k: args.inputPricePer1k,
    outputPricePer1k: args.outputPricePer1k,
    ...(args.cacheHitPricePer1k !== undefined
      ? { cacheHitPricePer1k: args.cacheHitPricePer1k }
      : {}),
    effectiveFrom: args.effectiveFrom,
    createdBy: args.createdBy,
  });
}

export async function listHistory(args: {
  readonly model: string;
  readonly provider: string;
}): Promise<PricingRow[]> {
  return listPricingHistory(args);
}

export async function listActive(): Promise<PricingRow[]> {
  return listActivePricing();
}

/**
 * Read the committed default pricing JSON and seed one pricing_rows
 * row per `(provider, model)` missing a history. Uses
 * `effective_from = epoch 0` so any pre-WP16 span resolves to a real
 * row. Idempotent: re-running is a no-op on already-seeded pairs.
 */
export async function seedFromJson(opts: {
  readonly createdBy: string;
  readonly effectiveFrom?: Date;
}): Promise<{ inserted: number; skipped: number }> {
  // Resolve the JSON relative to the built dist so the tool works from
  // any invocation directory.
  const here = dirname(fileURLToPath(import.meta.url));
  // apps/api/dist/admin/pricing.js -> packages/db/src/data/model-pricing.json
  const jsonPath = resolve(here, "../../../../packages/db/src/data/model-pricing.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const entries = JSON.parse(raw) as ReadonlyArray<{
    provider: string;
    modelPattern: string;
    inputCostPerToken: number;
    outputCostPerToken: number;
  }>;
  // Convert per-token to per-1k-tokens for the time-series storage.
  const rows = entries.map((e) => ({
    model: e.modelPattern,
    provider: e.provider,
    inputPricePer1k: e.inputCostPerToken * 1000,
    outputPricePer1k: e.outputCostPerToken * 1000,
  }));
  return seedLegacyPricing({
    rows,
    effectiveFrom: opts.effectiveFrom ?? new Date(0),
    createdBy: opts.createdBy,
  });
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

function parseArg(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

function requireArg(argv: readonly string[], flag: string): string {
  const v = parseArg(argv, flag);
  if (v === undefined) {
    throw new Error(`missing required flag ${flag}`);
  }
  return v;
}

export async function runCli(argv: readonly string[]): Promise<void> {
  if (process.env["FOXHOUND_ADMIN"] !== "1") {
    throw new Error(
      "apps/api/src/admin/pricing.ts: refused to run without FOXHOUND_ADMIN=1. " +
        "This is a last-mile safeguard; production should use the admin API surface.",
    );
  }
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "add": {
      const row = await addPricing({
        model: requireArg(rest, "--model"),
        provider: requireArg(rest, "--provider"),
        inputPricePer1k: Number(requireArg(rest, "--input-per-1k")),
        outputPricePer1k: Number(requireArg(rest, "--output-per-1k")),
        ...(parseArg(rest, "--cache-hit-per-1k") !== undefined
          ? { cacheHitPricePer1k: Number(parseArg(rest, "--cache-hit-per-1k")!) }
          : {}),
        effectiveFrom: new Date(requireArg(rest, "--effective-from")),
        createdBy: requireArg(rest, "--created-by"),
      });
      process.stdout.write(JSON.stringify(row, null, 2) + "\n");
      return;
    }
    case "list": {
      const rows = await listHistory({
        model: requireArg(rest, "--model"),
        provider: requireArg(rest, "--provider"),
      });
      process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
      return;
    }
    case "active": {
      const rows = await listActive();
      process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
      return;
    }
    case "seed": {
      const result = await seedFromJson({
        createdBy: parseArg(rest, "--created-by") ?? "admin-cli",
        ...(parseArg(rest, "--effective-from") !== undefined
          ? { effectiveFrom: new Date(parseArg(rest, "--effective-from")!) }
          : {}),
      });
      process.stdout.write(
        `seed complete: inserted=${result.inserted} skipped=${result.skipped}\n`,
      );
      return;
    }
    default:
      throw new Error(
        `unknown command: ${cmd ?? "(none)"}. Expected one of: add, list, active, seed.`,
      );
  }
}

// When invoked directly as `node .../admin/pricing.js <args>`.
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
