import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Billing: 98% stmts, 90% branch, 85% funcs — lock in high coverage.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 95,
        functions: 80,
        branches: 85,
        statements: 95,
      },
    },
  },
});
