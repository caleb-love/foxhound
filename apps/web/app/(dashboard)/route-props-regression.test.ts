import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dashboard app route prop contracts", () => {
  const cases = [
    {
      name: "diff page awaits searchParams",
      file: "(dashboard)/diff/page.tsx",
      requiredSnippets: ["searchParams: Promise<{", "const { a, b } = await searchParams;"],
    },
    {
      name: "replay detail page awaits params",
      file: "(dashboard)/replay/[id]/page.tsx",
      requiredSnippets: ["params: Promise<{ id: string }>;", "const { id } = await params;"],
    },
    {
      name: "trace detail page awaits params",
      file: "(dashboard)/traces/[id]/page.tsx",
      requiredSnippets: ["params: Promise<{ id: string }>;", "const { id } = await params;"],
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, () => {
      const source = readFileSync(resolve(__dirname, "..", testCase.file), "utf8");

      for (const snippet of testCase.requiredSnippets) {
        expect(source).toContain(snippet);
      }
    });
  }
});
