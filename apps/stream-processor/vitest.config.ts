import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// WP14 stream-processor — pure logic modules, strong coverage target.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
        statements: 85,
      },
    },
  },
});
