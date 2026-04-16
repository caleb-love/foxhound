import type { Trace } from "@foxhound/types";

/**
 * Extract prompt metadata from trace metadata fields.
 * Handles both snake_case (SDK convention) and camelCase (legacy) field names.
 */
export function getPromptMetadata(trace: Trace): {
  promptName?: string;
  promptVersion?: string | number;
} {
  const promptName =
    typeof trace.metadata?.prompt_name === "string"
      ? trace.metadata.prompt_name
      : typeof trace.metadata?.promptName === "string"
        ? trace.metadata.promptName
        : undefined;

  const promptVersion =
    typeof trace.metadata?.prompt_version === "string" ||
    typeof trace.metadata?.prompt_version === "number"
      ? trace.metadata.prompt_version
      : typeof trace.metadata?.promptVersion === "string" ||
          typeof trace.metadata?.promptVersion === "number"
        ? trace.metadata.promptVersion
        : undefined;

  return { promptName, promptVersion };
}

/**
 * Map from human-readable prompt name to the seeded prompt ID.
 * Used across sandbox routes for stable cross-linking.
 */
const PROMPT_ID_BY_NAME: Record<string, string> = {
  "support-reply": "prompt_support_reply",
  "refund-policy-check": "prompt_refund_policy_check",
  "escalation-triage": "prompt_escalation_triage",
};

/** Look up the seeded prompt ID by name. Returns undefined if not found. */
export function getPromptId(promptName: string): string | undefined {
  return PROMPT_ID_BY_NAME[promptName];
}

/** Build the prompt detail href for a given base path and prompt name. */
export function getPromptDetailHref(baseHref: string, promptName?: string): string | null {
  if (!promptName) return null;
  const promptId = PROMPT_ID_BY_NAME[promptName];
  return promptId ? `${baseHref}/prompts/${promptId}` : null;
}

/**
 * Build the prompt diff href for comparing versions.
 * When called with 3 args, infers versionA as (promptVersion - 1).
 * When called with 4 args, uses explicit versionA and versionB.
 */
export function getPromptDiffHref(
  baseHref: string,
  promptName?: string,
  versionAOrSingle?: string | number,
  versionB?: string | number,
): string | null {
  if (!promptName || versionAOrSingle === undefined) return null;
  const promptId = PROMPT_ID_BY_NAME[promptName];
  if (!promptId) return null;

  let finalA: string | number;
  let finalB: string | number;

  if (versionB !== undefined) {
    // 4-arg form: explicit versionA and versionB
    finalA = versionAOrSingle;
    finalB = versionB;
    if (finalA === finalB) return null;
  } else {
    // 3-arg form: infer baseline from single version
    const version = Number(versionAOrSingle);
    if (Number.isNaN(version)) return null;
    finalA = version > 1 ? version - 1 : version;
    finalB = version;
  }

  return `${baseHref}/prompts/${promptId}/diff?versionA=${encodeURIComponent(String(finalA))}&versionB=${encodeURIComponent(String(finalB))}`;
}

/**
 * Seeded hero comparison map: given a trace ID, return the most useful comparison target.
 * Used by trace detail view to suggest a "Compare" action.
 */
const HERO_COMPARISONS: Record<string, string> = {
  trace_returns_exception_v17_baseline: "trace_returns_exception_v18_regression",
  trace_returns_exception_v18_regression: "trace_returns_exception_v19_fix",
  trace_returns_exception_v19_fix: "trace_returns_exception_v18_regression",
  trace_damage_receipt_v18_hallucination: "trace_returns_exception_v17_baseline",
  trace_vip_chargeback_v18_missed_escalation: "trace_vip_chargeback_v19_restored_escalation",
  trace_vip_chargeback_v19_restored_escalation: "trace_vip_chargeback_v18_missed_escalation",
  trace_kb_timeout_failed: "trace_kb_timeout_recovered",
  trace_kb_timeout_recovered: "trace_kb_timeout_failed",
};

/** Get a suggested comparison trace for Run Diff. Falls back to the trace list. */
export function getSuggestedCompareHref(baseHref: string, trace: Trace): string {
  const comparisonTraceId = HERO_COMPARISONS[trace.id];
  return comparisonTraceId
    ? `${baseHref}/diff?a=${trace.id}&b=${comparisonTraceId}`
    : `${baseHref}/traces`;
}
