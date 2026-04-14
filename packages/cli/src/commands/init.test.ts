import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn();
const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: vi.fn().mockResolvedValue("interactive-key"), close: vi.fn() }),
}));

describe("registerInitCommand", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env["FOXHOUND_API_KEY"];
  });

  it("detects python langgraph project and writes python setup file", async () => {
    mockExistsSync.mockImplementation((path: string) => path.endsWith("pyproject.toml") || path.endsWith("foxhound_setup.py") === false);
    mockReadFileSync.mockReturnValue("langgraph\n");
    process.env["FOXHOUND_API_KEY"] = "fox-key";

    const { Command } = await import("commander");
    const { registerInitCommand } = await import("./init.js");
    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(["node", "cli", "init"]);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("foxhound_setup.py"),
      expect.stringContaining("FoxhoundClient"),
    );
  });

  it("prints snippet instead of overwriting existing file", async () => {
    mockExistsSync.mockImplementation((path: string) => path.endsWith("package.json") || path.endsWith("foxhound_setup.ts"));
    mockReadFileSync.mockReturnValue('{"dependencies":{"@anthropic-ai/sdk":"1.0.0"}}');
    process.env["FOXHOUND_API_KEY"] = "fox-key";

    const { Command } = await import("commander");
    const { registerInitCommand } = await import("./init.js");
    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(["node", "cli", "init"]);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("already exists"))).toBe(true);
  });

  it("uses interactive api key prompt when env and option are absent", async () => {
    mockExistsSync.mockReturnValue(false);

    const { Command } = await import("commander");
    const { registerInitCommand } = await import("./init.js");
    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(["node", "cli", "init"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
