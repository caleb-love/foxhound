import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 90,
        functions: 95,
        branches: 90,
        statements: 90,
      },
    },
  },
});
