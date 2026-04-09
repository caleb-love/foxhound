import type { Command } from "commander";
import chalk from "chalk";
import { getClient } from "../config.js";
import { isJsonMode, printJson } from "../output.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Check API health and usage summary")
    .action(async () => {
      const client = getClient();
      const [health, usage] = await Promise.all([client.getHealth(), client.getUsage()]);

      if (isJsonMode()) {
        printJson({ health, usage });
        return;
      }

      const statusColor = health.status === "ok" ? chalk.green : chalk.red;
      const pct =
        usage.spansLimit > 0 ? ((usage.spansUsed / usage.spansLimit) * 100).toFixed(1) : "∞";

      console.log(`API:     ${statusColor(health.status)} (v${health.version})`);
      console.log(`Period:  ${usage.period}`);
      console.log(
        `Spans:   ${usage.spansUsed.toLocaleString()} / ${usage.spansLimit > 0 ? usage.spansLimit.toLocaleString() : "unlimited"} (${pct}%)`,
      );
    });
}
