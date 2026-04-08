"""
Claude Agent SDK integration for the Fox observability SDK.

Instruments Claude Agent SDK agents by wrapping the ``query()`` async
generator and using ``PreToolUse`` / ``PostToolUse`` hooks to capture
tool invocations as structured Fox trace spans.

Usage::

    from fox_sdk import FoxClient
    from fox_sdk.integrations.claude_agent import FoxClaudeTracer

    fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")
    tracer = FoxClaudeTracer.from_client(fox, agent_id="my-claude-agent")

    # Option 1: Wrap the query() generator
    async for message in tracer.traced_query(
        prompt="Write a hello world script",
        options=options,
    ):
        print(message)
    await tracer.flush()

    # Option 2: Get hooks to inject into ClaudeAgentOptions
    hooks = tracer.get_hooks()
    options = ClaudeAgentOptions(hooks=hooks)
    # ... use with ClaudeSDKClient manually

Requires: ``pip install foxhound-ai[claude-agent]``
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any, AsyncIterator

from fox_sdk.tracer import ActiveSpan, Tracer

if TYPE_CHECKING:
    from fox_sdk.client import FoxClient

logger = logging.getLogger(__name__)


class FoxClaudeTracer:
    """
    Instruments Claude Agent SDK to emit Fox traces.

    Span-kind mapping
    -----------------
    - Agent query         → ``"workflow"`` (root)
    - Assistant message   → ``"llm_call"``
    - Tool use            → ``"tool_call"``

    Usage
    -----
    Use ``traced_query()`` to wrap the ``query()`` async generator, or
    call ``get_hooks()`` to get hook functions for manual injection into
    ``ClaudeAgentOptions``.
    """

    def __init__(self, tracer: Tracer) -> None:
        self._tracer = tracer
        self._workflow_span: ActiveSpan | None = None
        self._tool_spans: dict[str, ActiveSpan] = {}  # tool_use_id → span
        self._turn_count: int = 0

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_client(
        cls,
        client: "FoxClient",
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "FoxClaudeTracer":
        """Create a tracer from a ``FoxClient`` instance."""
        tracer = client.start_trace(
            agent_id=agent_id,
            session_id=session_id,
            metadata=metadata,
        )
        return cls(tracer)

    # ------------------------------------------------------------------
    # Public flush API
    # ------------------------------------------------------------------

    async def flush(self) -> None:
        """Flush the trace to the Fox API (async)."""
        self._end_open_tool_spans()
        await self._tracer.flush()

    def flush_sync(self) -> None:
        """Flush the trace to the Fox API (sync)."""
        self._end_open_tool_spans()
        self._tracer.flush_sync()

    @property
    def trace_id(self) -> str:
        return self._tracer.trace_id

    # ------------------------------------------------------------------
    # Hooks for ClaudeAgentOptions
    # ------------------------------------------------------------------

    def get_hooks(self) -> dict[str, list[Any]]:
        """Return hook config dict suitable for ClaudeAgentOptions.

        Usage::

            hooks = tracer.get_hooks()
            options = ClaudeAgentOptions(hooks=hooks)
        """
        return {
            "PreToolUse": [_make_hook_matcher(self._pre_tool_use)],
            "PostToolUse": [_make_hook_matcher(self._post_tool_use)],
        }

    async def _pre_tool_use(
        self,
        input_data: dict[str, Any],
        tool_use_id: str,
        context: Any,
    ) -> dict[str, Any]:
        """Hook called before a tool executes."""
        tool_name = input_data.get("tool_name", "unknown")
        parent_id = self._workflow_span.span_id if self._workflow_span else None

        span = self._tracer.start_span(
            name=f"tool:{tool_name}",
            kind="tool_call",
            parent_span_id=parent_id,
        )
        span.set_attribute("tool.name", tool_name)

        tool_input = input_data.get("tool_input", {})
        if isinstance(tool_input, dict):
            for key, value in tool_input.items():
                span.set_attribute(f"tool.input.{key}", _truncate(str(value), 512))
        else:
            span.set_attribute("tool.input", _truncate(str(tool_input), 1024))

        self._tool_spans[tool_use_id] = span
        return {}

    async def _post_tool_use(
        self,
        input_data: dict[str, Any],
        tool_use_id: str,
        context: Any,
    ) -> dict[str, Any]:
        """Hook called after a tool executes."""
        span = self._tool_spans.pop(tool_use_id, None)
        if span is None:
            return {}

        output = input_data.get("tool_result")
        if output is not None:
            span.set_attribute("tool.output", _truncate(str(output), 1024))

        error = input_data.get("error")
        if error:
            span.add_event("error", {"message": str(error)})
            span.end("error")
        else:
            span.end("ok")

        return {}

    # ------------------------------------------------------------------
    # Traced query wrapper
    # ------------------------------------------------------------------

    async def traced_query(
        self,
        prompt: str,
        options: Any = None,
        **kwargs: Any,
    ) -> AsyncIterator[Any]:
        """Wrap ``claude_agent_sdk.query()`` with tracing.

        Creates a workflow span, injects hooks, and yields each message
        from the agent loop while recording spans.

        Args:
            prompt: The prompt to send to Claude.
            options: ClaudeAgentOptions (hooks will be merged).
            **kwargs: Additional arguments passed to ``query()``.

        Yields:
            Messages from the Claude Agent SDK query generator.
        """
        try:
            from claude_agent_sdk import query as claude_query
        except ImportError:
            raise ImportError(
                "claude_agent_sdk is required for this integration. "
                "Install it with: pip install claude-agent-sdk"
            )

        # Start workflow span
        span = self._tracer.start_span(name="claude-agent", kind="workflow")
        self._workflow_span = span
        span.set_attribute("agent.prompt", _truncate(prompt, 512))

        # Merge our hooks into options
        merged_options = _merge_hooks(options, self.get_hooks())

        try:
            async for message in claude_query(prompt=prompt, options=merged_options, **kwargs):
                self._process_message(message)
                yield message
            span.end("ok")
        except Exception as exc:
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise
        finally:
            self._end_open_tool_spans()
            self._workflow_span = None

    # ------------------------------------------------------------------
    # Message processing
    # ------------------------------------------------------------------

    def on_message(self, message: Any) -> None:
        """Process a message from the agent loop for span recording.

        Call this manually when using ``ClaudeSDKClient`` directly
        instead of ``traced_query()``.
        """
        self._process_message(message)

    def start_workflow(self, prompt: str = "") -> None:
        """Manually start the workflow span (for ClaudeSDKClient usage)."""
        span = self._tracer.start_span(name="claude-agent", kind="workflow")
        self._workflow_span = span
        if prompt:
            span.set_attribute("agent.prompt", _truncate(prompt, 512))

    def end_workflow(self, status: str = "ok") -> None:
        """Manually end the workflow span."""
        self._end_open_tool_spans()
        if self._workflow_span:
            self._workflow_span.end(status)  # type: ignore[arg-type]
            self._workflow_span = None

    def _process_message(self, message: Any) -> None:
        """Extract span information from a Claude Agent SDK message."""
        msg_type = type(message).__name__

        if msg_type == "AssistantMessage":
            self._turn_count += 1
            parent_id = self._workflow_span.span_id if self._workflow_span else None

            # Record LLM call span for the assistant turn
            span = self._tracer.start_span(
                name=f"llm:claude:turn-{self._turn_count}",
                kind="llm_call",
                parent_span_id=parent_id,
            )

            # Extract model info if available
            model = getattr(message, "model", None)
            if model:
                span.set_attribute("llm.model", str(model))

            usage = getattr(message, "usage", None)
            if usage:
                input_tokens = getattr(usage, "input_tokens", None)
                output_tokens = getattr(usage, "output_tokens", None)
                if input_tokens is not None:
                    span.set_attribute("llm.prompt_tokens", input_tokens)
                if output_tokens is not None:
                    span.set_attribute("llm.completion_tokens", output_tokens)

            # Count content blocks
            content = getattr(message, "content", [])
            if content:
                text_blocks = sum(1 for b in content if type(b).__name__ == "TextBlock")
                tool_blocks = sum(1 for b in content if type(b).__name__ == "ToolUseBlock")
                span.set_attribute("llm.text_blocks", text_blocks)
                span.set_attribute("llm.tool_use_blocks", tool_blocks)

            span.end("ok")

        elif msg_type == "ResultMessage":
            # Final result — capture cost/duration if available
            cost = getattr(message, "cost_usd", None) or getattr(message, "cost", None)
            if cost is not None and self._workflow_span:
                self._workflow_span.set_attribute("agent.cost_usd", float(cost))

            duration = getattr(message, "duration_ms", None)
            if duration is not None and self._workflow_span:
                self._workflow_span.set_attribute("agent.duration_ms", duration)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _end_open_tool_spans(self) -> None:
        """End any tool spans that were never closed (e.g. timeout)."""
        for span in self._tool_spans.values():
            if span._span.end_time_ms is None:
                span.add_event("warning", {"message": "Tool span not closed by PostToolUse hook"})
                span.end("error")
        self._tool_spans.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_hook_matcher(hook_fn: Any) -> Any:
    """Create a HookMatcher-like dict that works with ClaudeAgentOptions."""
    # The SDK expects HookMatcher objects, but dicts with the right shape
    # also work in many versions. We try to import HookMatcher first.
    try:
        from claude_agent_sdk import HookMatcher
        return HookMatcher(matcher="*", hooks=[hook_fn])
    except ImportError:
        # Fallback: return a dict-like structure
        return {"matcher": "*", "hooks": [hook_fn]}


def _merge_hooks(options: Any, hooks: dict[str, list[Any]]) -> Any:
    """Merge Fox tracing hooks into existing ClaudeAgentOptions."""
    if options is None:
        try:
            from claude_agent_sdk import ClaudeAgentOptions
            return ClaudeAgentOptions(hooks=hooks)
        except ImportError:
            return None

    # Merge hooks into existing options
    existing_hooks = getattr(options, "hooks", None) or {}
    merged = dict(existing_hooks)
    for event_name, matchers in hooks.items():
        existing = merged.get(event_name, [])
        merged[event_name] = list(existing) + matchers

    # Try to set hooks on the options object
    if hasattr(options, "hooks"):
        options.hooks = merged
    elif isinstance(options, dict):
        options["hooks"] = merged

    return options


def _truncate(s: str, max_len: int) -> str:
    return s[:max_len] if len(s) > max_len else s
