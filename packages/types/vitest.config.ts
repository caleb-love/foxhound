import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Types: 100% coverage — lock it in.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95,
      },
    },
  },
});
