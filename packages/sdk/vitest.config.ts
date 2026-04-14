import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// Public SDK surface should move toward hardening-grade verification.
// Keep branch threshold high and raise line/function floors above shared defaults.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 85,
        statements: 70,
      },
    },
  },
});
