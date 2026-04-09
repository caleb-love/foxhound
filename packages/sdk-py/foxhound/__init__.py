"""
Foxhound SDK — compliance-grade observability for AI agent fleets.

Quickstart::

    from foxhound import FoxhoundClient

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

    # LangGraph (most common)
    from foxhound.integrations.langgraph import FoxCallbackHandler

    handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
    result = await graph.ainvoke(state, config={"callbacks": [handler]})
    await handler.flush()

    # Manual tracing
    async with fox.trace(agent_id="my-agent") as tracer:
        span = tracer.start_span(name="tool:search", kind="tool_call")
        span.set_attribute("query", "user question")
        span.end()
"""

from .client import FoxhoundClient
from .tracer import ActiveSpan, Tracer

__all__ = ["FoxhoundClient", "Tracer", "ActiveSpan"]
