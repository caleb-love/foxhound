import type { RedactionPolicy } from "./types.js";

/**
 * Default keys that flag an attribute as sensitive. Matching is case-insensitive
 * substring on the attribute *key*. Used by the evaluator and experiment workers
 * to scrub trace data before it crosses the network to a third-party LLM.
 */
export const DEFAULT_REDACTED_KEYS: ReadonlySet<string> = new Set([
  "api_key",
  "authorization",
  "password",
  "secret",
  "token",
  "cookie",
  "session_id",
  "credit_card",
  "ssn",
]);

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  keys: DEFAULT_REDACTED_KEYS,
  replacement: "[REDACTED]",
};

/**
 * Returns a new object with sensitive attribute values replaced by the policy's
 * replacement marker. The input is never mutated.
 */
export function redactAttributes(
  attrs: Record<string, unknown>,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    redacted[key] = isSensitive(key, policy) ? policy.replacement : value;
  }
  return redacted;
}

function isSensitive(key: string, policy: RedactionPolicy): boolean {
  const normalized = normalizeKey(key);
  for (const flag of policy.keys) {
    if (normalized.includes(normalizeKey(flag))) return true;
  }
  return false;
}

/**
 * Lowercase and replace `-` with `_` so hyphenated header-style keys
 * ("X-API-KEY-Header") match underscored flag substrings ("api_key").
 * Common in OTel span attributes carrying HTTP header values.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/-/g, "_");
}
