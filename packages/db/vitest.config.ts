import { defineConfig } from "vitest/config";

// DB package is tenant-critical. Keep coverage reporting enabled so gaps stay visible.
// Thresholds remain permissive for now because integration coverage still needs expansion,
// but they should be raised as the query layer is decomposed and test breadth improves.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 25,
        functions: 5,
        branches: 70,
        statements: 25,
      },
    },
  },
});
