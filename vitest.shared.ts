import { defineConfig } from "vitest/config";

/**
 * Shared coverage config — default thresholds prevent regression.
 * Packages above these defaults should override with higher thresholds.
 * Target: 80% across all metrics. See docs/plans/2026-04-12-testing-qa-gap-analysis.md.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 70,
        statements: 65,
      },
    },
  },
});
