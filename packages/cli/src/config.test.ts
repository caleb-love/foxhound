import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const MockApiClient = vi.fn();

vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock("@foxhound/api-client", () => ({
  FoxhoundApiClient: MockApiClient,
}));

describe("cli config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env["FOXHOUND_API_KEY"];
    delete process.env["FOXHOUND_ENDPOINT"];
  });

  it("loadConfig prefers env vars over file config", async () => {
    process.env["FOXHOUND_API_KEY"] = "env-key";
    process.env["FOXHOUND_ENDPOINT"] = "https://env.example.com";
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ apiKey: "file-key", endpoint: "http://file" }),
    );

    const { loadConfig } = await import("./config.js");
    expect(loadConfig()).toEqual({
      apiKey: "env-key",
      endpoint: "https://env.example.com",
    });
  });

  it("loadConfig falls back to file config and default endpoint", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ apiKey: "file-key" }));

    const { loadConfig } = await import("./config.js");
    expect(loadConfig()).toEqual({
      apiKey: "file-key",
      endpoint: "http://localhost:3001",
    });
  });

  it("saveConfig creates secure config directory and file", async () => {
    const { saveConfig } = await import("./config.js");
    saveConfig({ apiKey: "secret", endpoint: "https://api.example.com" });

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(".foxhound"), {
      recursive: true,
      mode: 0o700,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("config.json"),
      expect.stringContaining('"apiKey": "secret"'),
      { mode: 0o600 },
    );
  });

  it("getClient returns authenticated API client from loaded config", async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ apiKey: "file-key", endpoint: "https://api.example.com" }),
    );

    const { getClient } = await import("./config.js");
    getClient();

    expect(MockApiClient).toHaveBeenCalledWith({
      apiKey: "file-key",
      endpoint: "https://api.example.com",
    });
  });
});
