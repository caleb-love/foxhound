/**
 * @foxhound/prompt-rendering — shared types.
 *
 * Domain vocabulary (see CONTEXT.md):
 *   • Prompt — named, org-owned prompt artifact
 *   • Prompt version — immutable revision
 *   • Trace / Span — observability primitives feeding the evaluator/experiment paths
 */

/** A Mustache-style template string using {{key}} placeholders. */
export type PromptTemplate = string;

/** Variables interpolated into a template. Non-string values are JSON-stringified. */
export type TemplateVars = Record<string, unknown>;

/**
 * Policy controlling which attribute keys are redacted before a render reaches an LLM.
 *
 * Matching is case-insensitive substring on the attribute key (not value).
 * A key is redacted when any entry in `keys` appears as a substring of the lowercase key.
 */
export interface RedactionPolicy {
  /** Substrings (lowercased) that flag an attribute key as sensitive. */
  keys: ReadonlySet<string>;
  /** Replacement value written in place of the sensitive value. */
  replacement: string;
}

/**
 * Minimal shape of a Trace passed to extractTraceContext.
 *
 * Mirrors the shape returned by `getTraceWithSpans` in @foxhound/db, but kept
 * structural here so the rendering package does not import db types.
 */
export interface TraceLike {
  spans: ReadonlyArray<SpanLike>;
  metadata: Record<string, unknown>;
}

export interface SpanLike {
  name: string;
  kind: string;
  attributes: Record<string, unknown>;
  /** Events on the span; unused by extraction but retained for forward compatibility. */
  events?: ReadonlyArray<unknown>;
}

/**
 * Result of extracting trace context for template rendering.
 *
 * Carries an open index signature so the object is assignable to TemplateVars
 * at renderTemplate() call sites — concrete keys (input, output, spans,
 * metadata, spanCount) remain typed for callers that read them directly.
 */
export interface TraceContext {
  [key: string]: unknown;
  input: unknown;
  output: unknown;
  spans: string;
  metadata: string;
  spanCount: string;
}
