import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Notifications: 80% stmts, 86% branch, 95% funcs — at target.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 80,
        statements: 80,
      },
    },
  },
});
