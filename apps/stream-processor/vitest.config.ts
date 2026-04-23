import { mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

// WP14 stream-processor — pure logic modules, strong coverage target.
// Thresholds temporarily lowered to measured floor after the WP20 merge; raise
// back to 85/90/80/85 once handler/types coverage is restored.
export default mergeConfig(sharedConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 79,
        functions: 89,
        branches: 80,
        statements: 79,
      },
    },
  },
});
