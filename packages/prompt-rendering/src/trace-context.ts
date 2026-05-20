import { DEFAULT_REDACTION_POLICY, redactAttributes } from "./redaction.js";
import type { RedactionPolicy, TraceContext, TraceLike } from "./types.js";

/**
 * Extract input / output / span / metadata context from a Trace, ready for
 * template rendering. Applies the redaction policy to span attributes and
 * trace metadata before any value is exposed to a renderer.
 *
 * Result shape is stable so evaluator prompt templates with `{{input}}`,
 * `{{output}}`, `{{spans}}`, `{{metadata}}`, `{{spanCount}}` placeholders
 * keep working across surfaces.
 */
export function extractTraceContext(
  trace: TraceLike,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY,
): TraceContext {
  const redactedSpans = trace.spans.map((span) => ({
    name: span.name,
    kind: span.kind,
    attributes: redactAttributes(span.attributes, policy),
  }));

  const first = redactedSpans[0];
  const last = redactedSpans[redactedSpans.length - 1];

  return {
    input: first?.attributes?.["input"] ?? JSON.stringify(first?.attributes ?? {}),
    output: last?.attributes?.["output"] ?? JSON.stringify(last?.attributes ?? {}),
    spans: JSON.stringify(redactedSpans, null, 2),
    metadata: JSON.stringify(redactAttributes(trace.metadata, policy)),
    spanCount: String(trace.spans.length),
  };
}

/**
 * Convenience: render a template against a trace using the default redaction
 * policy. The two-step (extract → render) is preferred when callers want to
 * apply a custom policy or reuse the context across multiple templates.
 */
export function renderPromptForTrace(
  template: string,
  trace: TraceLike,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY,
): string {
  const context = extractTraceContext(trace, policy);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = (context as unknown as Record<string, unknown>)[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
