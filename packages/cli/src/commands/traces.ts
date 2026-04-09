import { Command } from "commander";
import chalk from "chalk";
import { toEpochMs } from "@foxhound/api-client";
import type { Span } from "@foxhound/types";
import { getClient } from "../config.js";
import { isJsonMode, printJson, printTable } from "../output.js";

export function registerTracesCommands(program: Command): void {
  const traces = program.command("traces").description("Query and inspect traces");

  traces
    .command("list")
    .description("Search traces")
    .option("--agent <name>", "Filter by agent ID")
    .option("--from <date>", "Start time (ISO 8601 or epoch ms)")
    .option("--to <date>", "End time (ISO 8601 or epoch ms)")
    .option("--limit <n>", "Max results", "20")
    .action(async (opts: { agent?: string; from?: string; to?: string; limit: string }) => {
      const client = getClient();

      const data = await client.searchTraces({
        agentId: opts.agent,
        from: opts.from ? toEpochMs(opts.from) : undefined,
        to: opts.to ? toEpochMs(opts.to) : undefined,
        limit: parseInt(opts.limit, 10),
      });

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      if (!data.data.length) {
        console.log("No traces found.");
        return;
      }

      const rows = data.data.map((t) => {
        const spanCount = t.spans?.length ?? 0;
        const errors = t.spans?.filter((s) => s.status === "error").length ?? 0;
        const duration =
          t.endTimeMs && t.startTimeMs
            ? `${((t.endTimeMs - t.startTimeMs) / 1000).toFixed(1)}s`
            : "—";

        return {
          ID: t.id,
          Agent: t.agentId,
          Spans: String(spanCount),
          Errors: errors > 0 ? chalk.red(String(errors)) : "0",
          Duration: duration,
          Time: new Date(t.startTimeMs).toISOString(),
        };
      });

      printTable(rows);
      console.log(`\n${data.pagination.count} trace(s), page ${data.pagination.page}`);
    });

  traces
    .command("get <id>")
    .description("Get a trace with its full span tree")
    .action(async (id: string) => {
      const client = getClient();
      const trace = await client.getTrace(id);

      if (isJsonMode()) {
        printJson(trace);
        return;
      }

      const duration =
        trace.endTimeMs && trace.startTimeMs
          ? `${((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(1)}s`
          : "in progress";

      console.log(chalk.bold(`Trace ${trace.id}`));
      console.log(`  Agent:    ${trace.agentId}`);
      if (trace.sessionId) console.log(`  Session:  ${trace.sessionId}`);
      console.log(`  Duration: ${duration}`);
      console.log(`  Spans:    ${trace.spans.length}`);
      console.log();

      const rootSpans = trace.spans.filter((s) => !s.parentSpanId);
      const childMap = new Map<string, Span[]>();
      for (const span of trace.spans) {
        if (span.parentSpanId) {
          const siblings = childMap.get(span.parentSpanId) ?? [];
          siblings.push(span);
          childMap.set(span.parentSpanId, siblings);
        }
      }

      for (const span of rootSpans) {
        printSpan(span, childMap, 0);
      }
    });

  traces
    .command("diff <id-a> <id-b>")
    .description("Compare two trace runs side-by-side")
    .action(async (idA: string, idB: string) => {
      const client = getClient();
      const diff = await client.diffRuns(idA, idB);

      if (isJsonMode()) {
        printJson(diff);
        return;
      }

      console.log(chalk.bold(`Diff: ${diff.runA} vs ${diff.runB}`));
      if (!diff.divergences.length) {
        console.log("  No divergences found.");
        return;
      }

      for (const d of diff.divergences) {
        console.log(`  ${chalk.yellow(d.spanName)} [${d.kind}]: ${d.difference}`);
      }
    });

  traces
    .command("replay <trace-id> <span-id>")
    .description("Replay agent state at a specific span")
    .action(async (traceId: string, spanId: string) => {
      const client = getClient();
      const replay = await client.replaySpan(traceId, spanId);

      if (isJsonMode()) {
        printJson(replay);
        return;
      }

      console.log(chalk.bold(`Replay: trace=${traceId} span=${spanId}`));
      console.log(JSON.stringify(replay.context, null, 2));
    });
}

function printSpan(span: Span, childMap: Map<string, Span[]>, indent: number): void {
  const prefix = "  ".repeat(indent);
  const dur =
    span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";
  const status = span.status === "error" ? chalk.red(" ERROR") : "";
  const kindTag = chalk.dim(`[${span.kind}]`);

  console.log(`${prefix}${kindTag} ${chalk.bold(span.name)} (${dur})${status}`);

  const attrs = Object.entries(span.attributes ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (attrs.length > 0) {
    const attrStr = attrs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
    console.log(`${prefix}  ${chalk.dim(attrStr)}`);
  }

  const children = childMap.get(span.spanId) ?? [];
  for (const child of children) {
    printSpan(child, childMap, indent + 1);
  }
}
