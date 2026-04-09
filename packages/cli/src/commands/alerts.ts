import type { Command } from "commander";
import chalk from "chalk";
import type { AlertEventType, AlertSeverity } from "@foxhound/api-client";
import { getClient } from "../config.js";
import { isJsonMode, printJson, printTable } from "../output.js";

const EVENT_TYPES: AlertEventType[] = [
  "agent_failure", "anomaly_detected", "cost_spike", "compliance_violation",
];
const SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "low"];

export function registerAlertsCommands(program: Command): void {
  const alerts = program.command("alerts").description("Manage alert rules");

  alerts
    .command("list")
    .description("List alert rules")
    .action(async () => {
      const client = getClient();
      const data = await client.listAlertRules();

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      if (!data.data.length) {
        console.log("No alert rules configured.");
        return;
      }

      const rows = data.data.map((r) => ({
        ID: r.id,
        Event: r.eventType,
        Severity: `>= ${r.minSeverity}`,
        Channel: r.channelId,
        Enabled: r.enabled ? chalk.green("yes") : chalk.dim("no"),
      }));

      printTable(rows);
    });

  alerts
    .command("create")
    .description("Create a new alert rule")
    .requiredOption("--event <type>", "Event type")
    .option("--severity <level>", "Minimum severity", "high")
    .requiredOption("--channel <id>", "Channel ID to route alerts to")
    .action(async (opts: { event: string; severity: string; channel: string }) => {
      if (!EVENT_TYPES.includes(opts.event as AlertEventType)) {
        console.error(`Invalid event type: ${opts.event}. Valid: ${EVENT_TYPES.join(", ")}`);
        process.exit(1);
      }
      if (!SEVERITIES.includes(opts.severity as AlertSeverity)) {
        console.error(`Invalid severity: ${opts.severity}. Valid: ${SEVERITIES.join(", ")}`);
        process.exit(1);
      }

      const client = getClient();
      const rule = await client.createAlertRule({
        eventType: opts.event as AlertEventType,
        minSeverity: opts.severity as AlertSeverity,
        channelId: opts.channel,
      });

      if (isJsonMode()) {
        printJson(rule);
        return;
      }

      console.log(`Alert rule created: ${chalk.bold(rule.id)}`);
      console.log(`  Event:    ${rule.eventType}`);
      console.log(`  Severity: >= ${rule.minSeverity}`);
      console.log(`  Channel:  ${rule.channelId}`);
    });

  alerts
    .command("delete <id>")
    .description("Delete an alert rule")
    .action(async (id: string) => {
      const client = getClient();
      await client.deleteAlertRule(id);

      if (isJsonMode()) {
        printJson({ success: true, id });
        return;
      }

      console.log(`Alert rule ${chalk.bold(id)} deleted.`);
    });
}
