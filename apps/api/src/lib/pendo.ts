/**
 * Server-side Pendo Track Event utility.
 * Sends events to the Pendo Track API via HTTP POST.
 * Failures are logged but never thrown — tracking must not break application flow.
 */

const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "3aba45b3-3573-4561-b8c4-8c74cf2f6803";

interface PendoTrackOptions {
  /** Descriptive event name */
  event: string;
  /** Unique user identifier (userId). Use "system" only if truly unavailable. */
  visitorId: string;
  /** Unique account identifier (orgId). Use "system" only if truly unavailable. */
  accountId: string;
  /** Optional event properties */
  properties?: Record<string, string | number | boolean | null | undefined>;
  /** Optional context (ip, userAgent, url) */
  context?: {
    ip?: string;
    userAgent?: string;
    url?: string;
  };
}

export function trackPendoEvent(options: PendoTrackOptions): void {
  const { event, visitorId, accountId, properties, context } = options;

  // Strip undefined values from properties
  const cleanProperties: Record<string, string | number | boolean | null> = {};
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined) {
        cleanProperties[key] = value;
      }
    }
  }

  const body = JSON.stringify({
    type: "track",
    event,
    visitorId,
    accountId,
    timestamp: Date.now(),
    properties: cleanProperties,
    ...(context ? { context } : {}),
  });

  fetch(PENDO_TRACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pendo-integration-key": PENDO_INTEGRATION_KEY,
    },
    body,
  }).catch(() => {
    // Silently ignore — tracking must not affect application flow
  });
}
