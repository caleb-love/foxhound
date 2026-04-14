import { beforeEach, describe, expect, it, vi } from "vitest";

const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();
const printTable = vi.fn();

vi.mock("../config.js", () => ({ getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson, printTable }));

describe("registerKeysCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keys list prints table in normal mode", async () => {
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({
      listApiKeys: vi.fn().mockResolvedValue({
        data: [{ id: "key-1", name: "prod", prefix: "sk-abc", createdAt: "now" }],
      }),
    });

    const { Command } = await import("commander");
    const { registerKeysCommands } = await import("./keys.js");
    const program = new Command();
    registerKeysCommands(program);

    await program.parseAsync(["node", "cli", "keys", "list"]);
    expect(printTable).toHaveBeenCalled();
  });

  it("keys create prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    const payload = { id: "key-1", name: "prod", key: "secret" };
    getClient.mockReturnValue({ createApiKey: vi.fn().mockResolvedValue(payload) });

    const { Command } = await import("commander");
    const { registerKeysCommands } = await import("./keys.js");
    const program = new Command();
    registerKeysCommands(program);

    await program.parseAsync(["node", "cli", "keys", "create", "--name", "prod"]);
    expect(printJson).toHaveBeenCalledWith(payload);
  });

  it("keys revoke prints success message in normal mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    isJsonMode.mockReturnValue(false);
    getClient.mockReturnValue({ revokeApiKey: vi.fn().mockResolvedValue(undefined) });

    const { Command } = await import("commander");
    const { registerKeysCommands } = await import("./keys.js");
    const program = new Command();
    registerKeysCommands(program);

    await program.parseAsync(["node", "cli", "keys", "revoke", "key-1"]);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("revoked"))).toBe(true);
    logSpy.mockRestore();
  });
});
