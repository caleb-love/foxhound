import { Command } from "commander";
import chalk from "chalk";
import { getClient } from "../config.js";
import { isJsonMode, printJson, printTable } from "../output.js";

export function registerKeysCommands(program: Command): void {
  const keys = program.command("keys").description("Manage API keys");

  keys
    .command("list")
    .description("List active API keys (masked)")
    .action(async () => {
      const client = getClient();
      const data = await client.listApiKeys();

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      if (!data.data.length) {
        console.log("No API keys found.");
        return;
      }

      const rows = data.data.map((k) => ({
        ID: k.id,
        Name: k.name,
        Prefix: `${k.prefix}...`,
        Created: k.createdAt,
      }));

      printTable(rows);
    });

  keys
    .command("create")
    .description("Create a new API key")
    .requiredOption("--name <name>", "Key name")
    .action(async (opts: { name: string }) => {
      const client = getClient();
      const result = await client.createApiKey(opts.name);

      if (isJsonMode()) {
        printJson(result);
        return;
      }

      console.log(`API key created: ${chalk.bold(result.id)}`);
      console.log(`  Name: ${result.name}`);
      console.log(`  Key:  ${chalk.yellow(result.key)}`);
      console.log();
      console.log(chalk.dim("Store this key securely — it cannot be retrieved again."));
    });

  keys
    .command("revoke <id>")
    .description("Revoke an API key")
    .action(async (id: string) => {
      const client = getClient();
      await client.revokeApiKey(id);

      if (isJsonMode()) {
        printJson({ success: true, id });
        return;
      }

      console.log(`API key ${chalk.bold(id)} revoked.`);
    });
}
