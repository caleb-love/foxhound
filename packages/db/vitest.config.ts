import { defineConfig } from "vitest/config";

// DB package uses integration tests that require a real database connection.
// Tests are skipped in CI without a DB — coverage thresholds disabled.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
