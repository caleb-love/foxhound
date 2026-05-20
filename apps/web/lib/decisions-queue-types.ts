/**
 * Decisions queue contract — shared between Fleet Overview and Executive
 * Summary so the same Issue/Insight/Action triad and OpinionatedSuggestion
 * shape render consistently across operator and exec views.
 *
 * See docs-site marketing copy + CONTEXT.md domain glossary for the canonical
 * definitions. Three entry kinds:
 *   - issue   — something is wrong (regression, breach, cost spike)
 *   - insight — a pattern Foxhound observed that the operator should know
 *   - action  — a proposed fix the operator can approve, edit, or reject
 *
 * Actions are the moat. Most actions carry an OpinionatedSuggestion citing a
 * supported framework explicitly: LangGraph, Claude Agent SDK, OpenAI Agents SDK.
 */

export type DecisionsQueueEntryKind = "issue" | "insight" | "action";

export type SupportedFramework = "langgraph" | "claude-agent-sdk" | "openai-agents-sdk";

export interface OpinionatedSuggestion {
  /** Which framework this suggestion targets. */
  framework: SupportedFramework;
  /** Human-readable description of what would change. */
  summary: string;
  /** Concrete diff or config snippet, as a string. Plain text; rendered in a <pre>. */
  diff: string;
  /** What we expect to improve. Shown next to the diff. */
  expectedImpact: string;
}

/** Display labels for {@link SupportedFramework}. */
export const FRAMEWORK_LABEL: Record<SupportedFramework, string> = {
  langgraph: "LangGraph",
  "claude-agent-sdk": "Claude Agent SDK",
  "openai-agents-sdk": "OpenAI Agents SDK",
};

/** Display labels for {@link DecisionsQueueEntryKind}. */
export const KIND_LABEL: Record<DecisionsQueueEntryKind, string> = {
  issue: "ISSUE",
  insight: "INSIGHT",
  action: "ACTION",
};
