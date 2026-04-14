import { beforeEach, describe, expect, it, vi } from "vitest";

const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();
const printTable = vi.fn();

vi.mock("../config.js", () => ({ getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson, printTable }));

describe("registerAlertsCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("alerts list prints table in normal mode", async () => {
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      listAlertRules: vi.fn().mockResolvedValue({
        data: [
          {
            id: "rule-1",
            eventType: "agent_failure",
            minSeverity: "high",
            channelId: "ch-1",
            enabled: true,
          },
        ],
      }),
    });

    const { Command } = await import("commander");
    const { registerAlertsCommands } = await import("./alerts.js");
    const program = new Command();
    registerAlertsCommands(program);

    await program.parseAsync(["node", "cli", "alerts", "list"]);
    expect(printTable).toHaveBeenCalled();
  });

  it("alerts create prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    const payload = {
      id: "rule-1",
      eventType: "agent_failure",
      minSeverity: "high",
      channelId: "ch-1",
    };
    getClient.mockReturnValue({ createAlertRule: vi.fn().mockResolvedValue(payload) });

    const { Command } = await import("commander");
    const { registerAlertsCommands } = await import("./alerts.js");
    const program = new Command();
    registerAlertsCommands(program);

    await program.parseAsync([
      "node",
      "cli",
      "alerts",
      "create",
      "--event",
      "agent_failure",
      "--channel",
      "ch-1",
    ]);
    expect(printJson).toHaveBeenCalledWith(payload);
  });

  it("alerts delete prints success message", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({ deleteAlertRule: vi.fn().mockResolvedValue(undefined) });

    const { Command } = await import("commander");
    const { registerAlertsCommands } = await import("./alerts.js");
    const program = new Command();
    registerAlertsCommands(program);

    await program.parseAsync(["node", "cli", "alerts", "delete", "rule-1"]);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("deleted"))).toBe(true);
    logSpy.mockRestore();
  });
});
