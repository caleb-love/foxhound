import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readComponent(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("investigation screen guardrails", () => {
  it("keeps trace detail inline and does not import the sheet overlay", () => {
    const source = readComponent("components/traces/trace-detail-view.tsx");

    expect(source).toContain("InvestigationDetailShell");
    expect(source).not.toContain("from '@/components/ui/sheet'");
    expect(source).not.toContain("<Sheet");
  });

  it("keeps replay detail inline and does not import the sheet overlay", () => {
    const source = readComponent("components/replay/replay-detail-view.tsx");

    expect(source).toContain("InvestigationDetailShell");
    expect(source).not.toContain("from '@/components/ui/sheet'");
    expect(source).not.toContain("<Sheet");
  });
});
