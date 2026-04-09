#!/usr/bin/env node

import { Command } from "commander";
import { setOutputMode } from "./output.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTracesCommands } from "./commands/traces.js";
import { registerAlertsCommands } from "./commands/alerts.js";
import { registerChannelsCommands } from "./commands/channels.js";
import { registerKeysCommands } from "./commands/keys.js";
import { registerInitCommand } from "./commands/init.js";

const program = new Command();

program
  .name("foxhound")
  .description("CLI for the Foxhound AI agent observability platform")
  .version("0.1.0")
  .option("--json", "Output as JSON")
  .option("--no-color", "Disable color output")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const opts: { json?: boolean; color?: boolean } = actionCommand.optsWithGlobals();
    setOutputMode({ json: opts.json, noColor: opts.color === false });
  });

registerAuthCommands(program);
registerStatusCommand(program);
registerTracesCommands(program);
registerAlertsCommands(program);
registerChannelsCommands(program);
registerKeysCommands(program);
registerInitCommand(program);

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
