import { beforeEach, describe, expect, it, vi } from "vitest";

const saveConfig = vi.fn();
const getClient = vi.fn();
const isJsonMode = vi.fn();
const printJson = vi.fn();
const getHealth = vi.fn();
const getMe = vi.fn();
const MockApiClient = vi.fn().mockImplementation(() => ({ getHealth }));

vi.mock("../config.js", () => ({ saveConfig, getClient }));
vi.mock("../output.js", () => ({ isJsonMode, printJson }));
vi.mock("@foxhound/api-client", () => ({ FoxhoundApiClient: MockApiClient }));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({
    question: vi.fn().mockResolvedValue("interactive-key"),
    close: vi.fn(),
  }),
}));

describe("registerAuthCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getHealth.mockResolvedValue({ status: "ok" });
    getMe.mockResolvedValue({
      user: { name: "Caleb", email: "caleb@example.com" },
      org: { name: "Foxhound", slug: "foxhound" },
      role: "owner",
    });
  });

  it("login verifies credentials and saves config", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { Command } = await import("commander");
    const { registerAuthCommands } = await import("./auth.js");
    const program = new Command();
    registerAuthCommands(program);

    await program.parseAsync([
      "node",
      "cli",
      "login",
      "--api-key",
      "fox-test-key",
      "--endpoint",
      "https://api.example.com",
    ]);

    expect(MockApiClient).toHaveBeenCalledWith({
      apiKey: "fox-test-key",
      endpoint: "https://api.example.com",
    });
    expect(saveConfig).toHaveBeenCalledWith({
      apiKey: "fox-test-key",
      endpoint: "https://api.example.com",
    });
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("Authenticated."))).toBe(true);
    logSpy.mockRestore();
  });

  it("whoami prints JSON in json mode", async () => {
    isJsonMode.mockReturnValue(true);
    getClient.mockReturnValue({ getMe });

    const { Command } = await import("commander");
    const { registerAuthCommands } = await import("./auth.js");
    const program = new Command();
    registerAuthCommands(program);

    await program.parseAsync(["node", "cli", "whoami"]);

    expect(printJson).toHaveBeenCalledWith({
      user: { name: "Caleb", email: "caleb@example.com" },
      org: { name: "Foxhound", slug: "foxhound" },
      role: "owner",
    });
  });
});
