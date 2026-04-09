import type { Command } from "commander";
import chalk from "chalk";
import type { ChannelKind } from "@foxhound/api-client";
import { getClient } from "../config.js";
import { isJsonMode, printJson, printTable } from "../output.js";

export function registerChannelsCommands(program: Command): void {
  const channels = program.command("channels").description("Manage notification channels");

  channels
    .command("list")
    .description("List notification channels")
    .action(async () => {
      const client = getClient();
      const data = await client.listChannels();

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      if (!data.data.length) {
        console.log("No notification channels configured.");
        return;
      }

      const rows = data.data.map((c) => ({
        ID: c.id,
        Kind: c.kind,
        Name: c.name,
        Created: c.createdAt,
      }));

      printTable(rows);
    });

  channels
    .command("add")
    .description("Add a notification channel")
    .requiredOption("--name <name>", "Channel name")
    .option("--type <type>", "Channel type", "slack")
    .requiredOption("--url <webhook-url>", "Slack webhook URL")
    .option("--slack-channel <channel>", "Slack channel override")
    .action(async (opts: { name: string; type: string; url: string; slackChannel?: string }) => {
      const validKinds: ChannelKind[] = ["slack"];
      if (!validKinds.includes(opts.type as ChannelKind)) {
        console.error(`Invalid channel type: ${opts.type}. Valid: ${validKinds.join(", ")}`);
        process.exit(1);
      }

      const client = getClient();
      const channel = await client.createChannel({
        name: opts.name,
        kind: opts.type as ChannelKind,
        config: {
          webhookUrl: opts.url,
          channel: opts.slackChannel,
        },
      });

      if (isJsonMode()) {
        printJson(channel);
        return;
      }

      console.log(`Channel created: ${chalk.bold(channel.id)}`);
      console.log(`  Name: ${channel.name}`);
      console.log(`  Kind: ${channel.kind}`);
    });

  channels
    .command("test <id>")
    .description("Send a test alert to a channel")
    .action(async (id: string) => {
      const client = getClient();
      await client.testChannel(id);

      if (isJsonMode()) {
        printJson({ ok: true, channelId: id });
        return;
      }

      console.log(`Test alert sent to channel ${chalk.bold(id)}.`);
    });

  channels
    .command("delete <id>")
    .description("Delete a notification channel")
    .action(async (id: string) => {
      const client = getClient();
      await client.deleteChannel(id);

      if (isJsonMode()) {
        printJson({ success: true, id });
        return;
      }

      console.log(`Channel ${chalk.bold(id)} deleted.`);
    });
}
