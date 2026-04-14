import { beforeEach, describe, expect, it, vi } from "vitest";

const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();
const printTable = vi.fn();

vi.mock("../config.js", () => ({ getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson, printTable }));

describe("registerChannelsCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("channels list prints table in normal mode", async () => {
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      listChannels: vi.fn().mockResolvedValue({
        data: [{ id: "ch-1", kind: "slack", name: "alerts", createdAt: "now" }],
      }),
    });

    const { Command } = await import("commander");
    const { registerChannelsCommands } = await import("./channels.js");
    const program = new Command();
    registerChannelsCommands(program);

    await program.parseAsync(["node", "cli", "channels", "list"]);
    expect(printTable).toHaveBeenCalled();
  });

  it("channels add prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    const payload = { id: "ch-1", name: "alerts", kind: "slack" };
    getClient.mockReturnValue({ createChannel: vi.fn().mockResolvedValue(payload) });

    const { Command } = await import("commander");
    const { registerChannelsCommands } = await import("./channels.js");
    const program = new Command();
    registerChannelsCommands(program);

    await program.parseAsync([
      "node",
      "cli",
      "channels",
      "add",
      "--name",
      "alerts",
      "--url",
      "https://hooks.slack.test/1",
    ]);
    expect(printJson).toHaveBeenCalledWith(payload);
  });

  it("channels delete prints success message", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({ deleteChannel: vi.fn().mockResolvedValue(undefined) });

    const { Command } = await import("commander");
    const { registerChannelsCommands } = await import("./channels.js");
    const program = new Command();
    registerChannelsCommands(program);

    await program.parseAsync(["node", "cli", "channels", "delete", "ch-1"]);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("deleted"))).toBe(true);
    logSpy.mockRestore();
  });
});
