import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { FoxhoundApiClient } from "@foxhound/api-client";

const CONFIG_DIR = join(homedir(), ".foxhound");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface CliConfig {
  endpoint: string;
  apiKey: string;
}

export function loadConfig(): Partial<CliConfig> {
  const envKey = process.env["FOXHOUND_API_KEY"];
  const envEndpoint = process.env["FOXHOUND_ENDPOINT"];

  let fileConfig: Partial<CliConfig> = {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    fileConfig = JSON.parse(raw) as Partial<CliConfig>;
  } catch {
    // No config file — that's fine
  }

  return {
    apiKey: envKey ?? fileConfig.apiKey,
    endpoint: envEndpoint ?? fileConfig.endpoint ?? "http://localhost:3001",
  };
}

export function saveConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

/** Load config, ensure API key is present, return an authenticated client. */
export function getClient(): FoxhoundApiClient {
  const config = loadConfig();
  if (!config.apiKey) {
    console.error("Not authenticated. Run `foxhound login` first or set FOXHOUND_API_KEY.");
    process.exit(1);
  }
  return new FoxhoundApiClient({ apiKey: config.apiKey, endpoint: config.endpoint! });
}
