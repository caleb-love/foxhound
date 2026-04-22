"""Agent-scope helpers (WP15).

The Foxhound SDK associates a single ``agent_id`` with each ``Tracer`` at
``fox.start_trace(agent_id=...)``. A multi-agent system, though, often
wants to attribute a subset of spans inside one trace to a distinct
subagent (a planner that delegates to a researcher, a coder, etc.).

These helpers keep the ergonomics small and explicit::

    tracer = fox.start_trace(agent_id="orchestrator")
    with with_agent(tracer, "researcher"):
        s = tracer.start_span(name="web.search", kind="tool_call")
        s.end()

Spans opened inside ``with_agent(tracer, "researcher")`` are tagged with
``agent_id = "researcher"`` on the wire, overriding the trace-level
default. Nesting is supported via a per-tracer stack; the context
manager pops the scope on exit (including on exception).

Ground rules
------------

1. Explicit, not magical. Callers must wrap the spans they want tagged.
   No attempt is made to infer subagent identity from span names or
   framework callbacks. See RFC-015 for the rationale.

2. Flat, not hierarchical. ``agent_id`` is a single string. Parent/child
   agent relationships live in the span tree via ``parent_span_id``. A
   future WP can introduce ``agent_parent_id`` as an additive field;
   until then, one id per span is the contract.

3. Zero cost off the hot path. The helpers do not allocate timers or
   observers. The scope stack is a plain list attached to the tracer
   and consulted at span-start time.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from ..tracer import ActiveSpan, SpanKind, Tracer


def current_agent_scope(tracer: Tracer) -> str | None:
    """Return the currently-active agent scope for ``tracer``, or ``None``.

    Intended for use by the tracer internals and tests; user code does
    not normally call this directly.
    """
    stack: list[str] = getattr(tracer, "_agent_scope_stack", [])
    return stack[-1] if stack else None


@contextmanager
def with_agent(tracer: Tracer, agent_id: str) -> Iterator[None]:
    """Push ``agent_id`` onto the tracer's agent scope for the block's lifetime.

    Every span opened inside the ``with`` block is tagged with this
    ``agent_id`` at wire-encode time. Nested ``with_agent`` calls stack;
    the innermost wins. The scope is popped even if the block raises.
    """
    stack: list[str] = getattr(tracer, "_agent_scope_stack", None)  # type: ignore[assignment]
    if stack is None:
        # Defensive: older Tracer instances may not have the stack field.
        # Attach a fresh one so the helper still works.
        stack = []
        setattr(tracer, "_agent_scope_stack", stack)
    stack.append(agent_id)
    try:
        yield
    finally:
        # Guard against unbalanced pops if a caller mutated the stack
        # reentrantly; ``with_agent`` is the only writer in practice.
        if stack and stack[-1] == agent_id:
            stack.pop()


def start_agent_span(
    tracer: Tracer,
    *,
    agent_id: str,
    name: str,
    kind: SpanKind,
    parent_span_id: str | None = None,
    attributes: dict[str, Any] | None = None,
) -> ActiveSpan:
    """Convenience wrapper: open a span pre-tagged with ``agent_id``.

    Equivalent to ``tracer.start_span(..., agent_id=agent_id)`` but
    matches the TypeScript SDK's ``startAgentSpan`` signature for
    cross-language parity.
    """
    return tracer.start_span(
        name=name,
        kind=kind,
        parent_span_id=parent_span_id,
        attributes=attributes,
        agent_id=agent_id,
    )
