import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Public SDK surface should move toward hardening-grade verification.
// Current coverage: ~61% lines/functions due to untested client methods.
// Raise these floors as coverage improves (target: 70%+).
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 85,
        statements: 60,
      },
    },
  },
});
