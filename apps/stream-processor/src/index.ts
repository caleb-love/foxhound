/**
 * App entrypoint (WP14).
 *
 * Wires the stream processor to real `@foxhound/db` reads and the
 * `@foxhound/notifications` dispatcher, then starts the consumer.
 * Handler order does not matter — each handler maintains its own state
 * and fires independently. If `FOXHOUND_USE_STREAM_PROCESSOR` is not
 * set to "true", this entrypoint exits cleanly so legacy BullMQ jobs
 * stay authoritative for alerts until the operator-gated cutover.
 */

import { dispatchAlert, type AlertEvent } from "@foxhound/notifications";
import type { NotificationChannel } from "@foxhound/notifications";
import {
  getAgentConfig,
  getAlertRulesForOrg,
  listNotificationChannels,
  getBaseline,
} from "@foxhound/db";
import { SlaHandler } from "./handlers/sla.js";
import { BudgetHandler } from "./handlers/budget.js";
import { RegressionHandler } from "./handlers/regression.js";
import { EvalTriggerHandler } from "./handlers/eval-trigger.js";
import type {
  AgentConfigView,
  AlertEmitter,
  BaselineView,
  DataAccess,
  EvalTriggerRule,
} from "./handlers/types.js";
import { StreamProcessor } from "./processor.js";

// ---------------------------------------------------------------------------
// Feature flag gate.
// ---------------------------------------------------------------------------

const FLAG = process.env["FOXHOUND_USE_STREAM_PROCESSOR"];
const ENABLED = FLAG === "true" || FLAG === "1";

// ---------------------------------------------------------------------------
// Minimal stderr logger — avoids a pino runtime cost for an app that
// currently prints a few lines per second.
// ---------------------------------------------------------------------------

const log = {
  info: (obj: Record<string, unknown> | string, msg?: string) => {
    const payload = typeof obj === "string" ? { msg: obj } : { ...obj, msg: msg ?? obj["msg"] };
    process.stderr.write(`${JSON.stringify({ level: "info", ...payload })}\n`);
  },
  warn: (obj: Record<string, unknown> | string, msg?: string) => {
    const payload = typeof obj === "string" ? { msg: obj } : { ...obj, msg: msg ?? obj["msg"] };
    process.stderr.write(`${JSON.stringify({ level: "warn", ...payload })}\n`);
  },
  error: (obj: Record<string, unknown> | string, msg?: string) => {
    const payload = typeof obj === "string" ? { msg: obj } : { ...obj, msg: msg ?? obj["msg"] };
    process.stderr.write(`${JSON.stringify({ level: "error", ...payload })}\n`);
  },
};

// ---------------------------------------------------------------------------
// Production DataAccess adapter. Reads through `@foxhound/db`. In this WP
// the evaluator enqueue + eval-trigger list fall back to empty arrays
// until WP-follow-up: `eval_triggers` is a new table that will land in
// the WP14 migration PR once operator cutover is scheduled.
// ---------------------------------------------------------------------------

function makeDataAccess(): DataAccess {
  return {
    async getAgentConfig(orgId, agentId) {
      const row = await getAgentConfig(orgId, agentId);
      if (!row) return null;
      const out: AgentConfigView = {
        orgId,
        agentId,
        costBudgetUsd: row.costBudgetUsd ? Number(row.costBudgetUsd) : null,
        budgetPeriod:
          row.budgetPeriod === "weekly" || row.budgetPeriod === "monthly"
            ? row.budgetPeriod
            : "daily",
        costAlertThresholdPct: row.costAlertThresholdPct ?? null,
        maxDurationMs: row.maxDurationMs ?? null,
        minSuccessRate: row.minSuccessRate === null ? null : Number(row.minSuccessRate),
        evaluationWindowMs: row.evaluationWindowMs ?? null,
        minSampleSize: row.minSampleSize ?? null,
      };
      return out;
    },
    async getBaseline(orgId, agentId, agentVersion) {
      const row = await getBaseline(orgId, agentId, agentVersion);
      if (!row) return null;
      const view: BaselineView = {
        orgId,
        agentId,
        agentVersion,
        sampleSize: row.sampleSize,
        spanStructure: row.spanStructure,
      };
      return view;
    },
    async listEvalTriggers(_orgId) {
      // eval_triggers table lands in a follow-up migration; until then
      // return no rules so the handler is a no-op in production.
      const rules: readonly EvalTriggerRule[] = [];
      return rules;
    },
    async getAlertRouting(orgId) {
      const [rules, channels] = await Promise.all([
        getAlertRulesForOrg(orgId),
        listNotificationChannels({ orgId }),
      ]);
      const map = new Map<string, NotificationChannel>(
        channels.map((c) => [c.id, c as unknown as NotificationChannel]),
      );
      return { rules, channels: map };
    },
    async enqueueEvaluatorRun(_input) {
      // Evaluator enqueue stays on the existing BullMQ path via
      // `apps/api/src/queue.ts`; the stream processor does not own
      // the evaluator queue client today.
    },
  };
}

function makeEmitter(data: DataAccess): AlertEmitter {
  return {
    async emit(event: AlertEvent) {
      try {
        const routing = await data.getAlertRouting(event.orgId);
        await dispatchAlert(event, [...routing.rules], routing.channels, {
          error: (obj, msg) => log.error(obj as Record<string, unknown>, msg),
        });
      } catch (err) {
        log.error({ err, type: event.type, orgId: event.orgId }, "stream: emit failed");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!ENABLED) {
    log.info(
      { flag: "FOXHOUND_USE_STREAM_PROCESSOR" },
      "stream-processor disabled by feature flag; exiting cleanly",
    );
    return;
  }

  const data = makeDataAccess();
  const emitter = makeEmitter(data);

  const sla = new SlaHandler({ data, emitter });
  const budget = new BudgetHandler({ data, emitter });
  const regression = new RegressionHandler({ data, emitter });
  const evalTrigger = new EvalTriggerHandler({ data });

  const processor = new StreamProcessor({
    log,
    handlers: [sla, budget, regression, evalTrigger],
  });

  await processor.start();

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, "stream-processor: shutdown signal");
    await processor.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  log.error({ err: String(err) }, "stream-processor: fatal");
  process.exit(1);
});
