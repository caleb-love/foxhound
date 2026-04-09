import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { FoxhoundApiClient } from "@foxhound/api-client";
import { loadConfig, saveConfig, getClient } from "../config.js";
import { isJsonMode, printJson } from "../output.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Authenticate and store credentials")
    .option(
      "--api-key <key>",
      "API key (prefer interactive input or FOXHOUND_API_KEY env var to avoid shell history exposure)",
    )
    .option("--endpoint <url>", "API endpoint", "http://localhost:3001")
    .action(async (opts: { apiKey?: string; endpoint: string }) => {
      let apiKey = opts.apiKey ?? "";

      if (!apiKey) {
        const rl = createInterface({ input: stdin, output: stdout });
        apiKey = await rl.question("API key: ");
        rl.close();
      }

      if (!apiKey) {
        console.error("No API key provided.");
        process.exit(1);
      }

      // Verify the key works
      const client = new FoxhoundApiClient({ apiKey, endpoint: opts.endpoint });
      try {
        await client.getHealth();
      } catch (err) {
        console.error("Failed to connect:", err instanceof Error ? err.message : err);
        process.exit(1);
      }

      saveConfig({ apiKey, endpoint: opts.endpoint });
      console.log(`Authenticated. Config saved to ~/.foxhound/config.json`);
    });

  program
    .command("whoami")
    .description("Show current user and organization")
    .action(async () => {
      const client = getClient();
      const me = await client.getMe();

      if (isJsonMode()) {
        printJson(me);
        return;
      }

      console.log(`User:  ${me.user.name} (${me.user.email})`);
      if (me.org) {
        console.log(`Org:   ${me.org.name} (${me.org.slug})`);
      }
      if (me.role) {
        console.log(`Role:  ${me.role}`);
      }
    });
}
