import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Worker: 83% stmts, 77% branch, 93% funcs — above default.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 75,
        statements: 80,
      },
    },
  },
});
