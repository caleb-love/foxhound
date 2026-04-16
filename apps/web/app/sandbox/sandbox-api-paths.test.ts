import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("sandbox pages avoid hardcoded localhost sandbox API URLs", () => {
  const internalApiCases = [
    "traces/[id]/page.tsx",
    "diff/page.tsx",
    "replay/[id]/page.tsx",
  ] as const;

  for (const file of internalApiCases) {
    it(`${file} avoids hardcoded localhost sandbox API URLs`, () => {
      const source = readFileSync(resolve(__dirname, file), "utf8");

      expect(source).toContain("getRequestUrl");
      expect(source).toContain("/api/sandbox/traces");
      expect(source).not.toContain("http://localhost:3001/api/sandbox");
    });
  }

  it("traces/page.tsx uses demo-domain directly without hardcoded URLs", () => {
    const source = readFileSync(resolve(__dirname, "traces/page.tsx"), "utf8");

    expect(source).toContain("buildLocalReviewDemo");
    expect(source).not.toContain("http://localhost:3001/api/sandbox");
  });
});
