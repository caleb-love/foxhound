import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// SDK client.ts has many thin wrapper methods that lower coverage.
// Current: ~58% lines/stmts. Target: 80%.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 85,
        statements: 55,
      },
    },
  },
});
