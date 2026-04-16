import { beforeEach, describe, expect, it, vi } from "vitest";

const setOutputMode = vi.fn();
const registerAuthCommands = vi.fn();
const registerStatusCommand = vi.fn();
const registerTracesCommands = vi.fn();
const registerAlertsCommands = vi.fn();
const registerChannelsCommands = vi.fn();
const registerKeysCommands = vi.fn();
const registerInitCommand = vi.fn();
const parseAsync = vi.fn().mockResolvedValue(undefined);
const hook = vi.fn();
const option = vi.fn();
const version = vi.fn();
const description = vi.fn();
const name = vi.fn();

vi.mock("./output.js", () => ({ setOutputMode }));
vi.mock("./commands/auth.js", () => ({ registerAuthCommands }));
vi.mock("./commands/status.js", () => ({ registerStatusCommand }));
vi.mock("./commands/traces.js", () => ({ registerTracesCommands }));
vi.mock("./commands/alerts.js", () => ({ registerAlertsCommands }));
vi.mock("./commands/channels.js", () => ({ registerChannelsCommands }));
vi.mock("./commands/keys.js", () => ({ registerKeysCommands }));
vi.mock("./commands/init.js", () => ({ registerInitCommand }));
vi.mock("commander", () => ({
  Command: vi.fn().mockImplementation(() => ({
    name: (...args: unknown[]) => {
      name(...args);
      return this;
    },
  })),
}));

vi.mock("commander", () => {
  const commandApi = {
    name: (...args: unknown[]) => {
      name(...args);
      return commandApi;
    },
    description: (...args: unknown[]) => {
      description(...args);
      return commandApi;
    },
    version: (...args: unknown[]) => {
      version(...args);
      return commandApi;
    },
    option: (...args: unknown[]) => {
      option(...args);
      return commandApi;
    },
    hook: (...args: unknown[]) => {
      hook(...args);
      return commandApi;
    },
    parseAsync,
  };
  return { Command: vi.fn(() => commandApi) };
});

describe("cli index", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("registers all command groups and parses args", async () => {
    await import("./index.js");

    expect(registerAuthCommands).toHaveBeenCalled();
    expect(registerStatusCommand).toHaveBeenCalled();
    expect(registerTracesCommands).toHaveBeenCalled();
    expect(registerAlertsCommands).toHaveBeenCalled();
    expect(registerChannelsCommands).toHaveBeenCalled();
    expect(registerKeysCommands).toHaveBeenCalled();
    expect(registerInitCommand).toHaveBeenCalled();
    expect(parseAsync).toHaveBeenCalled();
  });

  it("installs preAction hook for output mode", async () => {
    await import("./index.js");
    expect(hook).toHaveBeenCalledWith("preAction", expect.any(Function));

    const preAction = hook.mock.calls.find((c) => c[0] === "preAction")?.[1] as (...args: unknown[]) => void;
    preAction({}, { optsWithGlobals: () => ({ json: true, color: false }) });
    expect(setOutputMode).toHaveBeenCalledWith({ json: true, noColor: true });
  });
});
