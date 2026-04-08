import { createHmac } from "node:crypto";
import type {
  NotificationProvider,
  AlertEvent,
  NotificationChannel,
  WebhookChannelConfig,
} from "../types.js";

/** Retry delays in milliseconds: 1s, 4s, 16s */
const RETRY_DELAYS_MS = [1_000, 4_000, 16_000];

/**
 * Generic webhook notification provider with HMAC-SHA256 signing.
 *
 * Signs every request with the org-scoped secret and sends the Foxhound
 * alert payload as JSON.  Failed deliveries are retried up to 3 times
 * with exponential backoff (1s / 4s / 16s).
 *
 * Signature header: `X-Foxhound-Signature: sha256=<hex>`
 *
 * Payload shape:
 * ```json
 * {
 *   "event": "agent_failure",
 *   "severity": "critical",
 *   "orgId": "...",
 *   "agentId": "...",
 *   "traceId": "...",
 *   "sessionId": "...",
 *   "message": "...",
 *   "traceUrl": "...",
 *   "metadata": { ... },
 *   "occurredAt": "2024-01-01T00:00:00.000Z"
 * }
 * ```
 */
export class WebhookProvider implements NotificationProvider {
  readonly kind = "webhook";

  async send(event: AlertEvent, channel: NotificationChannel): Promise<void> {
    const config = channel.config as WebhookChannelConfig;
    const body = buildPayload(event, config);
    const bodyStr = JSON.stringify(body);
    const signature = sign(bodyStr, config.secret);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Foxhound-Signature": `sha256=${signature}`,
      "X-Foxhound-Event": event.type,
      "User-Agent": "Foxhound-Webhooks/1.0",
      ...config.headers,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: "POST",
          headers,
          body: bodyStr,
        });

        if (response.ok) {
          return; // success
        }

        const text = await response.text().catch(() => "(no body)");
        lastError = new Error(`Webhook returned ${response.status}: ${text}`);

        // 4xx errors (except 429) are not retryable
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw lastError;
        }
      } catch (err) {
        if (err instanceof Error) {
          lastError = err;
        } else {
          lastError = new Error(String(err));
        }
        // Re-throw non-retryable errors immediately
        if (lastError.message.match(/returned 4\d\d/) && !lastError.message.includes("429")) {
          throw lastError;
        }
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
      }
    }

    throw lastError ?? new Error("Webhook delivery failed after retries");
  }
}

function buildPayload(event: AlertEvent, config: WebhookChannelConfig): Record<string, unknown> {
  const traceUrl =
    event.traceId && config.dashboardBaseUrl
      ? `${config.dashboardBaseUrl}/traces/${event.traceId}`
      : undefined;

  const payload: Record<string, unknown> = {
    event: event.type,
    severity: event.severity,
    orgId: event.orgId,
    agentId: event.agentId,
    message: event.message,
    metadata: event.metadata,
    occurredAt: event.occurredAt.toISOString(),
  };

  if (event.traceId) payload["traceId"] = event.traceId;
  if (event.sessionId) payload["sessionId"] = event.sessionId;
  if (traceUrl) payload["traceUrl"] = traceUrl;

  return payload;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
