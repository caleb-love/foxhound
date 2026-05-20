/**
 * @foxhound/prompt-rendering — shared prompt template rendering + trace redaction.
 *
 * Single home for the Mustache-style template renderer, the default
 * redaction policy, and the trace→context extractor used by both the
 * Evaluator and Experiment worker queues. See CONTEXT.md for the domain
 * vocabulary (Trace, Span, Evaluator, Experiment, Prompt).
 */

export type {
  PromptTemplate,
  TemplateVars,
  RedactionPolicy,
  TraceLike,
  SpanLike,
  TraceContext,
} from "./types.js";

export { renderTemplate } from "./template.js";
export { DEFAULT_REDACTED_KEYS, DEFAULT_REDACTION_POLICY, redactAttributes } from "./redaction.js";
export { extractTraceContext, renderPromptForTrace } from "./trace-context.js";
