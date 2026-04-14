import { beforeEach, describe, expect, it, vi } from "vitest";

const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();

vi.mock("../config.js", () => ({ getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson }));

describe("registerStatusCommand", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    getClient.mockReturnValue({
      getHealth: vi.fn().mockResolvedValue({ status: "ok", version: "1.2.3" }),
      getUsage: vi.fn().mockResolvedValue({ period: "2026-04", spansUsed: 12, spansLimit: 100 }),
    });

    const { Command } = await import("commander");
    const { registerStatusCommand } = await import("./status.js");
    const program = new Command();
    registerStatusCommand(program);

    await program.parseAsync(["node", "cli", "status"]);

    expect(printJson).toHaveBeenCalledWith({
      health: { status: "ok", version: "1.2.3" },
      usage: { period: "2026-04", spansUsed: 12, spansLimit: 100 },
    });
  });

  it("prints human-readable status in normal mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      getHealth: vi.fn().mockResolvedValue({ status: "ok", version: "1.2.3" }),
      getUsage: vi.fn().mockResolvedValue({ period: "2026-04", spansUsed: 12, spansLimit: 100 }),
    });

    const { Command } = await import("commander");
    const { registerStatusCommand } = await import("./status.js");
    const program = new Command();
    registerStatusCommand(program);

    await program.parseAsync(["node", "cli", "status"]);

    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("API:"))).toBe(true);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("Period:"))).toBe(true);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("Spans:"))).toBe(true);
    logSpy.mockRestore();
  });
});
