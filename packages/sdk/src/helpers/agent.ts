/**
 * Agent-scope helpers (WP15).
 *
 * The Foxhound SDK associates a single `agentId` with each `Trace` at
 * `client.startTrace({ agentId })`. A multi-agent system, though, often
 * wants to attribute a subset of spans inside one trace to a distinct
 * subagent (a planner that delegates to a researcher, a coder, etc.).
 *
 * These helpers keep the ergonomics small and explicit:
 *
 *   const tracer = fox.startTrace({ agentId: "orchestrator" });
 *   withAgent(tracer, "researcher", () => {
 *     const s = tracer.startSpan({ name: "web.search", kind: "tool_call" });
 *     // ...
 *     s.end();
 *   });
 *
 * Spans opened inside `withAgent(tracer, "researcher", …)` are tagged
 * with `agentId = "researcher"` on the wire, overriding the trace-level
 * default. Nesting is supported by a per-tracer stack; `withAgent` pops
 * the scope on function exit (including async completion, if the callback
 * returns a Promise).
 *
 * Ground rules:
 *
 * 1. Explicit, not magical. Callers must wrap the spans they want tagged.
 *    No attempt is made to infer subagent identity from span names or
 *    framework callbacks. See RFC-015 for the rationale.
 *
 * 2. Flat, not hierarchical. `agentId` is a single string. Parent/child
 *    agent relationships live in the span tree via `parentSpanId`. A
 *    future WP can introduce `agent_parent_id` as an additive field;
 *    until then, one id per span is the contract.
 *
 * 3. Zero cost off the hot path. The helpers do not allocate timers or
 *    observers. The scope stack is a pure in-process array attached to
 *    the tracer and consulted at span-start time.
 */
import type { SpanKind } from "@foxhound/types";
import { Tracer, ActiveSpan } from "../tracer.js";

// ---------------------------------------------------------------------------
// Per-tracer agent scope stack.
//
// We keep this off the `Tracer` class public surface to avoid growing the
// TracerOptions contract. The WeakMap keys are Tracer instances; Tracers
// are short-lived (one per trace), so the map never leaks.
// ---------------------------------------------------------------------------

const scopeStacks = new WeakMap<Tracer, string[]>();

function stackFor(tracer: Tracer): string[] {
  let stack = scopeStacks.get(tracer);
  if (!stack) {
    stack = [];
    scopeStacks.set(tracer, stack);
  }
  return stack;
}

/**
 * Return the currently-active agent scope for this tracer, or `undefined`
 * if no scope is active. Intended for use by the tracer internals; user
 * code does not normally call this directly.
 */
export function currentAgentScope(tracer: Tracer): string | undefined {
  const stack = scopeStacks.get(tracer);
  if (!stack || stack.length === 0) return undefined;
  return stack[stack.length - 1];
}

/**
 * Run `fn` with `agentId` pushed as the active agent scope on `tracer`.
 * The scope is popped before the returned Promise settles, even if `fn`
 * throws. Nested `withAgent` calls stack; the innermost wins for spans
 * opened inside it.
 *
 * Overhead is a single array push/pop per call; the benchmark gate in
 * WP15 (set_agent overhead < 0.1 ms per span) is met by construction.
 */
export function withAgent<T>(
  tracer: Tracer,
  agentId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const stack = stackFor(tracer);
  stack.push(agentId);
  const pop = (): void => {
    // Guard against an unbalanced pop if a caller mutates the stack
    // reentrantly; in practice `withAgent` is the only writer.
    const top = stack[stack.length - 1];
    if (top === agentId) stack.pop();
  };
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(pop);
    }
    pop();
    return Promise.resolve(result);
  } catch (err) {
    // Convert sync throws into promise rejections so the declared
    // `Promise<T>` return type is honored. Callers awaiting `withAgent`
    // always see rejections, never synchronous throws.
    pop();
    return Promise.reject(err);
  }
}

/**
 * Synchronous variant of `withAgent` for callers that do not have an
 * async context and do not want to touch Promises. Scope is popped in a
 * `try/finally`.
 */
export function withAgentSync<T>(
  tracer: Tracer,
  agentId: string,
  fn: () => T,
): T {
  const stack = stackFor(tracer);
  stack.push(agentId);
  try {
    return fn();
  } finally {
    const top = stack[stack.length - 1];
    if (top === agentId) stack.pop();
  }
}

/**
 * Convenience wrapper that opens a span with an explicit `agentId` and
 * the standard tracer options. Equivalent to wrapping
 * `tracer.startSpan({ ... })` in a `withAgent(...)`, but returns the
 * `ActiveSpan` directly so the caller can `end()` it imperatively.
 */
export function startAgentSpan(
  tracer: Tracer,
  params: {
    agentId: string;
    name: string;
    kind: SpanKind;
    parentSpanId?: string;
    attributes?: Record<string, string | number | boolean | null>;
  },
): ActiveSpan {
  const span = tracer.startSpan({
    name: params.name,
    kind: params.kind,
    ...(params.parentSpanId !== undefined ? { parentSpanId: params.parentSpanId } : {}),
    ...(params.attributes !== undefined ? { attributes: params.attributes } : {}),
  });
  span.setAgent(params.agentId);
  return span;
}
