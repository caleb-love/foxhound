import { randomUUID } from "crypto";
import type { AlertEvent, AlertRule, NotificationChannel } from "./types.js";
import { dispatchAlert } from "./dispatcher.js";

/**
 * Pino-compatible logger contract. Workers using a `log.error(msg, obj)`
 * shape wrap with `{ error: (obj, msg) => log.error(msg, obj) }`.
 */
export interface AlertLogger {
  error: (obj: unknown, msg: string) => void;
}

/**
 * Persistent row written by the notification-log writer. Every field listed
 * below is required for tenant-scoped accounting except `traceId` and
 * `dedupeKey`, which are optional based on the event.
 */
export interface NotificationLogInput {
  id: string;
  orgId: string;
  ruleId: string;
  channelId: string;
  eventType: AlertEvent["type"];
  severity: AlertEvent["severity"];
  agentId: string;
  traceId?: string;
  status: "sent" | "failed";
  dedupeKey?: string;
}

/**
 * Injected dependencies. Lives in the consumer (api/worker) so this package
 * stays decoupled from `@foxhound/db` and any specific logger.
 */
export interface AlertFiringDeps {
  /** Org-scoped fetch — caller must obey CLAUDE.md §5 tenant scope rules. */
  getAlertRulesForOrg: (orgId: string) => Promise<AlertRule[]>;
  /** Org-scoped channel listing. */
  listNotificationChannels: (filter: { orgId: string }) => Promise<NotificationChannel[]>;
  /**
   * Persists one notification log row. Returns null when the supplied
   * `dedupeKey` already exists (caller's DB enforces idempotency).
   */
  createNotificationLogEntry: (entry: NotificationLogInput) => Promise<{ id: string } | null>;
  /** Optional dispatch override for tests. Defaults to the package's dispatchAlert. */
  dispatch?: typeof dispatchAlert;
  /** Optional logger forwarded to the dispatcher and provider implementations. */
  logger?: AlertLogger;
}

export interface FireOptions {
  /**
   * When set, the service writes the notification log entry *before* dispatch
   * with a `dedupeKey` of `${dedupeKey}:${rule.id}`. Rules whose insert
   * conflicts are skipped — giving exactly-once delivery per (org, key, rule).
   *
   * Omit to write the log entry post-dispatch (best-effort delivery, the
   * default for trace-failure firings where the agent_failure stream itself
   * provides natural deduplication).
   */
  dedupeKey?: string;
  /**
   * Side-hook called with the rules matched by event type, *before* dedupe
   * filtering. Use for analytics emissions that should fire regardless of
   * dedupe outcome (e.g. Pendo "alert_dispatched" tracking). Errors from this
   * hook are not caught — keep the implementation defensive.
   */
  onMatchedRules?: (matched: AlertRule[]) => void;
}

export interface FireResult {
  /** Rules whose `eventType` matched the event. */
  matchedRuleCount: number;
  /** Rules that survived channel-existence + dedupe filtering. */
  eligibleRuleCount: number;
  /** Number of rules actually handed to the dispatcher. */
  dispatched: number;
}

export interface AlertFiringService {
  fireEvent(event: AlertEvent, options?: FireOptions): Promise<FireResult>;
}

/**
 * Creates the alert-firing service. One module owns rule fetch, channel
 * resolution, dedupe, and dispatch for every alert site in the platform —
 * traces ingestion, cost monitoring, SLA checks, regression detection.
 *
 * Tenant scope (org_id) flows from the event itself; no caller threads it.
 */
export function createAlertFiringService(deps: AlertFiringDeps): AlertFiringService {
  const dispatch = deps.dispatch ?? dispatchAlert;
  return {
    async fireEvent(event, options = {}) {
      const orgId = event.orgId;

      const [rules, channels] = await Promise.all([
        deps.getAlertRulesForOrg(orgId),
        deps.listNotificationChannels({ orgId }),
      ]);

      const channelMap = new Map<string, NotificationChannel>(channels.map((c) => [c.id, c]));

      const matched = rules.filter((rule) => rule.eventType === event.type);
      options.onMatchedRules?.(matched);

      if (matched.length === 0) {
        return { matchedRuleCount: 0, eligibleRuleCount: 0, dispatched: 0 };
      }

      const eligible: AlertRule[] = [];
      const dedupeKey = options.dedupeKey;
      for (const rule of matched) {
        if (!channelMap.has(rule.channelId)) continue;

        if (dedupeKey !== undefined) {
          const entry = await deps.createNotificationLogEntry(
            buildLogEntry(event, rule, `${dedupeKey}:${rule.id}`),
          );
          if (entry === null) continue;
        }
        eligible.push(rule);
      }

      if (eligible.length === 0) {
        return { matchedRuleCount: matched.length, eligibleRuleCount: 0, dispatched: 0 };
      }

      await dispatch(event, eligible, channelMap, deps.logger);

      if (dedupeKey === undefined) {
        await Promise.allSettled(
          eligible.map((rule) =>
            deps.createNotificationLogEntry(buildLogEntry(event, rule, undefined)),
          ),
        );
      }

      return {
        matchedRuleCount: matched.length,
        eligibleRuleCount: eligible.length,
        dispatched: eligible.length,
      };
    },
  };
}

function buildLogEntry(
  event: AlertEvent,
  rule: AlertRule,
  dedupeKey: string | undefined,
): NotificationLogInput {
  const base: NotificationLogInput = {
    id: randomUUID(),
    orgId: event.orgId,
    ruleId: rule.id,
    channelId: rule.channelId,
    eventType: event.type,
    severity: event.severity,
    agentId: event.agentId,
    status: "sent",
  };
  if (event.traceId !== undefined) base.traceId = event.traceId;
  if (dedupeKey !== undefined) base.dedupeKey = dedupeKey;
  return base;
}
