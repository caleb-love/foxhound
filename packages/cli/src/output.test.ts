import { beforeEach, describe, expect, it, vi } from "vitest";
import { isJsonMode, printJson, printTable, setOutputMode } from "./output.js";

const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

describe("cli output helpers", () => {
  beforeEach(() => {
    logSpy.mockClear();
    setOutputMode({ json: false, noColor: false });
  });

  it("tracks json mode state", () => {
    expect(isJsonMode()).toBe(false);
    setOutputMode({ json: true });
    expect(isJsonMode()).toBe(true);
  });

  it("printJson writes formatted JSON", () => {
    printJson({ ok: true, count: 2 });
    expect(logSpy).toHaveBeenCalledWith(`{
  "ok": true,
  "count": 2
}`);
  });

  it("printTable renders header and rows", () => {
    printTable([
      { name: "alpha", status: "ok" },
      { name: "beta", status: "failed" },
    ]);

    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain("name");
    expect(String(logSpy.mock.calls[2]?.[0])).toContain("alpha");
    expect(String(logSpy.mock.calls[3]?.[0])).toContain("beta");
  });

  it("printTable is a no-op for empty rows", () => {
    printTable([]);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
