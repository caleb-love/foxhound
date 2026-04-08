"""
Autogen / AG2 integration for the Fox observability SDK.

Instruments Autogen/AG2 multi-agent conversations by patching agent reply
methods and wrapping ``initiate_chat`` to produce structured Fox traces.

Cross-agent trace correlation
-----------------------------
When multiple agents participate in a conversation, each agent gets its own
``"agent_step"`` span under the root ``"workflow"`` span.  Conversation
turns, tool/function calls, and code execution are recorded as children::

    workflow (conversation)
    ├── agent:AssistantAgent
    │   ├── llm_call  (generate_reply → LLM completion)
    │   └── tool_call (function call result)
    └── agent:UserProxyAgent
        ├── tool_call (function execution)
        └── tool_call (code execution, code.exec=True)

Usage::

    from fox_sdk import FoxClient
    from fox_sdk.integrations.autogen import FoxAutogenTracer, instrument

    fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")

    # One-line auto-instrumentation
    tracer = instrument(fox, agent_id="my-autogen-app", agents=[assistant, user_proxy])

    # Run conversation normally
    user_proxy.initiate_chat(assistant, message="Write a hello world script")
    tracer.flush_sync()

    # Or use the class directly for more control
    tracer = FoxAutogenTracer.from_client(fox, agent_id="my-app")
    tracer.instrument(agents=[assistant, user_proxy])
    await tracer.traced_initiate_chat(user_proxy, assistant, message="Hello!")
    await tracer.flush()

Requires: ``pip install fox-sdk[autogen]``
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from fox_sdk.tracer import ActiveSpan, Tracer

if TYPE_CHECKING:
    from fox_sdk.client import FoxClient

logger = logging.getLogger(__name__)


class FoxAutogenTracer:
    """
    Instruments Autogen / AG2 agents to emit Fox traces.

    Span-kind mapping
    -----------------
    - Conversation (initiate_chat)  → ``"workflow"`` (root)
    - Agent conversation turn       → ``"agent_step"`` (per-agent, child of workflow)
    - LLM reply generation          → ``"llm_call"`` (child of agent span)
    - Function/tool call execution  → ``"tool_call"`` (child of agent span)
    - Code execution (sandbox)      → ``"tool_call"`` with ``code.exec=True``

    Thread / async safety
    ---------------------
    Autogen may use threads in some execution modes.  Span operations are
    safe on CPython due to the GIL.  Use one tracer instance per conversation.

    Usage
    -----
    Call :meth:`instrument` with your agent list to patch them.  Then run
    the conversation via :meth:`traced_initiate_chat`, or let patched agents
    run normally and wrap the ``initiate_chat`` call yourself by calling
    :meth:`start_workflow` / :meth:`end_workflow` around it.  Call
    :meth:`flush` (or :meth:`flush_sync`) when done.
    """

    def __init__(self, tracer: Tracer) -> None:
        self._tracer = tracer
        self._workflow_span: ActiveSpan | None = None
        # agent_name → ActiveSpan (long-lived, per conversation)
        self._agent_spans: dict[str, ActiveSpan] = {}
        # id(agent) → original method dict (for uninstrument support)
        self._patches: dict[int, dict[str, Any]] = {}

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
    ) -> "FoxAutogenTracer":
        """Create a tracer from a :class:`~fox_sdk.client.FoxClient` instance."""
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
        self._end_all_agent_spans()
        if self._workflow_span and self._workflow_span._span.end_time_ms is None:
            self._workflow_span.end("ok")
        self._workflow_span = None
        await self._tracer.flush()

    def flush_sync(self) -> None:
        """Flush the trace to the Fox API (sync)."""
        self._end_all_agent_spans()
        if self._workflow_span and self._workflow_span._span.end_time_ms is None:
            self._workflow_span.end("ok")
        self._workflow_span = None
        self._tracer.flush_sync()

    @property
    def trace_id(self) -> str:
        return self._tracer.trace_id

    # ------------------------------------------------------------------
    # Instrumentation
    # ------------------------------------------------------------------

    def instrument(self, agents: list[Any]) -> None:
        """Patch a list of Autogen agents for tracing.

        Safe to call multiple times; already-patched agents are skipped.
        Each agent's ``generate_reply``, ``a_generate_reply``,
        ``execute_function``, and ``generate_code_execution_reply`` methods
        are wrapped to emit Fox spans.

        Args:
            agents: List of ``ConversableAgent`` (or subclass) instances.
        """
        for agent in agents:
            self._patch_agent(agent)

    def uninstrument(self, agents: list[Any]) -> None:
        """Remove Fox instrumentation from a list of agents."""
        for agent in agents:
            patches = self._patches.pop(id(agent), {})
            for method_name, original in patches.items():
                if hasattr(agent, method_name):
                    setattr(agent, method_name, original)

    def _patch_agent(self, agent: Any) -> None:
        """Monkey-patch a single agent's relevant methods."""
        agent_id = id(agent)
        if agent_id in self._patches:
            return  # already patched

        saved: dict[str, Any] = {}
        agent_name = _get_agent_name(agent)

        # --- generate_reply (sync) ---
        if hasattr(agent, "generate_reply"):
            orig = agent.generate_reply
            saved["generate_reply"] = orig

            def _patched_generate_reply(
                messages: Any = None,
                sender: Any = None,
                _orig: Any = orig,
                _agent_name: str = agent_name,
                _agent: Any = agent,
                **kwargs: Any,
            ) -> Any:
                return self._traced_generate_reply(
                    _agent_name, _orig, messages, sender, **kwargs
                )

            agent.generate_reply = _patched_generate_reply

        # --- a_generate_reply (async) ---
        if hasattr(agent, "a_generate_reply"):
            orig_async = agent.a_generate_reply
            saved["a_generate_reply"] = orig_async

            async def _patched_a_generate_reply(
                messages: Any = None,
                sender: Any = None,
                _orig: Any = orig_async,
                _agent_name: str = agent_name,
                **kwargs: Any,
            ) -> Any:
                return await self._traced_a_generate_reply(
                    _agent_name, _orig, messages, sender, **kwargs
                )

            agent.a_generate_reply = _patched_a_generate_reply

        # --- execute_function (sync function/tool calls) ---
        if hasattr(agent, "execute_function"):
            orig_func = agent.execute_function
            saved["execute_function"] = orig_func

            def _patched_execute_function(
                func_call: Any,
                _orig: Any = orig_func,
                _agent_name: str = agent_name,
                **kwargs: Any,
            ) -> Any:
                return self._traced_execute_function(
                    _agent_name, _orig, func_call, **kwargs
                )

            agent.execute_function = _patched_execute_function

        # --- generate_code_execution_reply (code execution / sandbox) ---
        if hasattr(agent, "generate_code_execution_reply"):
            orig_code = agent.generate_code_execution_reply
            saved["generate_code_execution_reply"] = orig_code

            def _patched_code_execution(
                messages: Any = None,
                sender: Any = None,
                _orig: Any = orig_code,
                _agent_name: str = agent_name,
                **kwargs: Any,
            ) -> Any:
                return self._traced_code_execution(
                    _agent_name, _orig, messages, sender, **kwargs
                )

            agent.generate_code_execution_reply = _patched_code_execution

        self._patches[agent_id] = saved

    # ------------------------------------------------------------------
    # Workflow span management
    # ------------------------------------------------------------------

    def start_workflow(
        self, initiator_name: str = "conversation", message: str = ""
    ) -> None:
        """Open a workflow span — call before initiating a conversation."""
        span = self._tracer.start_span(name="conversation", kind="workflow")
        if initiator_name:
            span.set_attribute("autogen.initiator", initiator_name)
        if message:
            span.set_attribute("autogen.initial_message", _truncate(message, 512))
        self._workflow_span = span

    def end_workflow(self, status: str = "ok") -> None:
        """Close the workflow span — call after the conversation finishes."""
        self._end_all_agent_spans()
        if self._workflow_span:
            self._workflow_span.end(status)  # type: ignore[arg-type]
            self._workflow_span = None

    # ------------------------------------------------------------------
    # Traced initiate_chat wrappers
    # ------------------------------------------------------------------

    def traced_initiate_chat(
        self,
        initiator: Any,
        recipient: Any,
        message: str = "",
        **kwargs: Any,
    ) -> Any:
        """Wrap ``initiator.initiate_chat(recipient, ...)`` with a workflow span.

        Args:
            initiator:  The agent that starts the conversation.
            recipient:  The receiving agent.
            message:    The initial message string.
            **kwargs:   Additional kwargs forwarded to ``initiate_chat``.

        Returns:
            The result of ``initiate_chat``.
        """
        initiator_name = _get_agent_name(initiator)
        self.start_workflow(initiator_name=initiator_name, message=str(message))
        assert self._workflow_span is not None
        span = self._workflow_span
        try:
            result = initiator.initiate_chat(recipient, message=message, **kwargs)
            self._end_all_agent_spans()
            span.end("ok")
            return result
        except Exception as exc:
            self._end_all_agent_spans()
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise
        finally:
            self._workflow_span = None

    async def traced_initiate_chat_async(
        self,
        initiator: Any,
        recipient: Any,
        message: str = "",
        **kwargs: Any,
    ) -> Any:
        """Async variant of :meth:`traced_initiate_chat`."""
        initiator_name = _get_agent_name(initiator)
        self.start_workflow(initiator_name=initiator_name, message=str(message))
        assert self._workflow_span is not None
        span = self._workflow_span
        try:
            result = await initiator.a_initiate_chat(recipient, message=message, **kwargs)
            self._end_all_agent_spans()
            span.end("ok")
            return result
        except Exception as exc:
            self._end_all_agent_spans()
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise
        finally:
            self._workflow_span = None

    # ------------------------------------------------------------------
    # Internal traced method implementations
    # ------------------------------------------------------------------

    def _get_or_create_agent_span(self, agent_name: str) -> ActiveSpan:
        """Lazily create an agent-level span as a child of the workflow."""
        if agent_name in self._agent_spans:
            return self._agent_spans[agent_name]

        parent_span_id = (
            self._workflow_span.span_id if self._workflow_span else None
        )
        span = self._tracer.start_span(
            name=f"agent:{agent_name}",
            kind="agent_step",
            parent_span_id=parent_span_id,
        )
        span.set_attribute("agent.name", agent_name)
        self._agent_spans[agent_name] = span
        return span

    def _end_all_agent_spans(self) -> None:
        for span in self._agent_spans.values():
            if span._span.end_time_ms is None:
                span.end("ok")
        self._agent_spans.clear()

    def _traced_generate_reply(
        self,
        agent_name: str,
        original: Any,
        messages: Any,
        sender: Any,
        **kwargs: Any,
    ) -> Any:
        """Wrap ``generate_reply`` — records an llm_call or agent_step span."""
        agent_span = self._get_or_create_agent_span(agent_name)
        parent_span_id = agent_span.span_id

        span = self._tracer.start_span(
            name=f"reply:{agent_name}",
            kind="llm_call",
            parent_span_id=parent_span_id,
        )
        span.set_attribute("agent.name", agent_name)
        if sender is not None:
            span.set_attribute("agent.sender", _get_agent_name(sender))
        if messages:
            span.set_attribute("llm.message_count", len(messages))
            last_msg = messages[-1] if messages else None
            if isinstance(last_msg, dict):
                content = last_msg.get("content", "")
                if content:
                    span.set_attribute("llm.last_message", _truncate(str(content), 512))

        try:
            result = original(messages=messages, sender=sender, **kwargs)
            _annotate_reply_span(span, result)
            span.end("ok")
            return result
        except Exception as exc:
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise

    async def _traced_a_generate_reply(
        self,
        agent_name: str,
        original: Any,
        messages: Any,
        sender: Any,
        **kwargs: Any,
    ) -> Any:
        """Async wrapper for ``a_generate_reply``."""
        agent_span = self._get_or_create_agent_span(agent_name)
        parent_span_id = agent_span.span_id

        span = self._tracer.start_span(
            name=f"reply:{agent_name}",
            kind="llm_call",
            parent_span_id=parent_span_id,
        )
        span.set_attribute("agent.name", agent_name)
        if sender is not None:
            span.set_attribute("agent.sender", _get_agent_name(sender))
        if messages:
            span.set_attribute("llm.message_count", len(messages))

        try:
            result = await original(messages=messages, sender=sender, **kwargs)
            _annotate_reply_span(span, result)
            span.end("ok")
            return result
        except Exception as exc:
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise

    def _traced_execute_function(
        self,
        agent_name: str,
        original: Any,
        func_call: Any,
        **kwargs: Any,
    ) -> Any:
        """Wrap ``execute_function`` — records a tool_call span."""
        agent_span = self._get_or_create_agent_span(agent_name)

        func_name = _extract_func_name(func_call)
        func_args = _extract_func_args(func_call)

        span = self._tracer.start_span(
            name=f"tool:{func_name}",
            kind="tool_call",
            parent_span_id=agent_span.span_id,
        )
        span.set_attribute("tool.name", func_name)
        if func_args:
            span.set_attribute("tool.input", _truncate(str(func_args), 1024))

        try:
            result = original(func_call, **kwargs)
            output = _extract_func_result(result)
            if output:
                span.set_attribute("tool.output", _truncate(str(output), 1024))
            span.end("ok")
            return result
        except Exception as exc:
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise

    def _traced_code_execution(
        self,
        agent_name: str,
        original: Any,
        messages: Any,
        sender: Any,
        **kwargs: Any,
    ) -> Any:
        """Wrap ``generate_code_execution_reply`` — records a code exec span."""
        agent_span = self._get_or_create_agent_span(agent_name)

        span = self._tracer.start_span(
            name=f"code_exec:{agent_name}",
            kind="tool_call",
            parent_span_id=agent_span.span_id,
        )
        span.set_attribute("code.exec", True)
        span.set_attribute("agent.name", agent_name)

        # Try to extract code snippet from last message
        if messages:
            last = messages[-1]
            content = last.get("content", "") if isinstance(last, dict) else ""
            if content:
                span.set_attribute("code.snippet", _truncate(str(content), 512))

        try:
            result = original(messages=messages, sender=sender, **kwargs)
            # result is typically (success, output_dict) or a ConversableAgent reply tuple
            if isinstance(result, tuple) and len(result) == 2:
                success, output = result
                if isinstance(output, dict):
                    exit_code = output.get("exit_code")
                    if exit_code is not None:
                        span.set_attribute("code.exit_code", exit_code)
                    stdout = output.get("output") or output.get("stdout", "")
                    if stdout:
                        span.set_attribute("code.output", _truncate(str(stdout), 1024))
            span.end("ok")
            return result
        except Exception as exc:
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------


def instrument(
    client: "FoxClient",
    agent_id: str,
    agents: list[Any],
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> FoxAutogenTracer:
    """One-line auto-instrumentation for Autogen / AG2 agents.

    Patches all provided agents so their conversation turns, tool calls,
    and code execution steps are captured as Fox spans automatically.

    Args:
        client:     An initialised :class:`~fox_sdk.client.FoxClient`.
        agent_id:   Identifier for the application being traced.
        agents:     List of ``ConversableAgent`` instances to instrument.
        session_id: Optional session / conversation identifier.
        metadata:   Optional key-value metadata attached to the trace.

    Returns:
        A :class:`FoxAutogenTracer` with all agents already patched — call
        :meth:`~FoxAutogenTracer.flush` or :meth:`~FoxAutogenTracer.flush_sync`
        when done.

    Raises:
        ImportError: If ``autogen`` (or ``ag2``) is not installed.
    """
    _check_autogen_installed()
    tracer = FoxAutogenTracer.from_client(
        client,
        agent_id=agent_id,
        session_id=session_id,
        metadata=metadata,
    )
    tracer.instrument(agents)
    return tracer


def _check_autogen_installed() -> None:
    """Raise ImportError if neither autogen nor ag2 is importable."""
    for pkg in ("autogen", "autogen_agentchat", "pyautogen"):
        try:
            __import__(pkg)
            return
        except ImportError:
            continue
    raise ImportError(
        "An Autogen-compatible package is required for this integration. "
        "Install with: pip install fox-sdk[autogen]"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_agent_name(agent: Any) -> str:
    """Extract a human-readable name from an Autogen agent."""
    # AG2 / Autogen v0.4+: agent has a .name attribute
    name = getattr(agent, "name", None)
    if name:
        return str(name)
    # Fallback: class name
    return type(agent).__name__


def _annotate_reply_span(span: ActiveSpan, result: Any) -> None:
    """Attach metadata from a generate_reply result to an llm_call span."""
    if result is None:
        return
    # Autogen reply functions return (success: bool, reply: str | None)
    if isinstance(result, tuple) and len(result) == 2:
        _, reply = result
        if reply is not None and isinstance(reply, str):
            span.set_attribute("llm.reply_preview", _truncate(reply, 256))
    elif isinstance(result, str):
        span.set_attribute("llm.reply_preview", _truncate(result, 256))


def _extract_func_name(func_call: Any) -> str:
    """Extract the function name from a function call payload."""
    if isinstance(func_call, dict):
        return str(
            func_call.get("name")
            or func_call.get("function", {}).get("name", "unknown")
        )
    name = getattr(func_call, "name", None)
    if name:
        return str(name)
    # OpenAI-style tool call object
    fn = getattr(func_call, "function", None)
    if fn:
        return str(getattr(fn, "name", "unknown"))
    return "unknown"


def _extract_func_args(func_call: Any) -> str:
    """Extract function arguments as a string."""
    if isinstance(func_call, dict):
        args = (
            func_call.get("arguments")
            or func_call.get("function", {}).get("arguments")
        )
        return str(args) if args is not None else ""
    args = getattr(func_call, "arguments", None)
    if args is not None:
        return str(args)
    fn = getattr(func_call, "function", None)
    if fn:
        return str(getattr(fn, "arguments", ""))
    return ""


def _extract_func_result(result: Any) -> str:
    """Extract the output string from a function execution result."""
    if result is None:
        return ""
    if isinstance(result, tuple) and len(result) == 2:
        _, output = result
        return str(output) if output is not None else ""
    if isinstance(result, dict):
        return str(result.get("content") or result.get("output") or "")
    return str(result)


def _truncate(s: str, max_len: int) -> str:
    return s[:max_len] if len(s) > max_len else s
