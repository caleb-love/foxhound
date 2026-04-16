import { beforeEach, describe, expect, it, vi } from "vitest";

const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();
const printTable = vi.fn();

vi.mock("../config.js", () => ({ getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson, printTable }));

describe("registerTracesCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("traces list prints table output in normal mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      searchTraces: vi.fn().mockResolvedValue({
        data: [
          {
            id: "trace-1",
            agentId: "agent-a",
            startTimeMs: 1000,
            endTimeMs: 2000,
            spans: [{ status: "ok" }, { status: "error" }],
          },
        ],
        pagination: { count: 1, page: 1 },
      }),
    });

    const { Command } = await import("commander");
    const { registerTracesCommands } = await import("./traces.js");
    const program = new Command();
    registerTracesCommands(program);

    await program.parseAsync(["node", "cli", "traces", "list"]);

    expect(printTable).toHaveBeenCalled();
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("trace(s), page 1"))).toBe(true);
    logSpy.mockRestore();
  });

  it("traces list prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    const payload = { data: [], pagination: { count: 0, page: 1 } };
    getClient.mockReturnValue({ searchTraces: vi.fn().mockResolvedValue(payload) });

    const { Command } = await import("commander");
    const { registerTracesCommands } = await import("./traces.js");
    const program = new Command();
    registerTracesCommands(program);

    await program.parseAsync(["node", "cli", "traces", "list"]);

    expect(printJson).toHaveBeenCalledWith(payload);
  });

  it("traces diff prints no divergences message", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      diffRuns: vi.fn().mockResolvedValue({ runA: "a", runB: "b", divergences: [] }),
    });

    const { Command } = await import("commander");
    const { registerTracesCommands } = await import("./traces.js");
    const program = new Command();
    registerTracesCommands(program);

    await program.parseAsync(["node", "cli", "traces", "diff", "a", "b"]);

    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("No divergences found."))).toBe(
      true,
    );
    logSpy.mockRestore();
  });
});
