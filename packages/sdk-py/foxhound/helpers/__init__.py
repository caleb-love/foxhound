"""Foxhound SDK helpers — opt-in ergonomics layered on top of Tracer."""

from .agent import with_agent, current_agent_scope, start_agent_span

__all__ = ["with_agent", "current_agent_scope", "start_agent_span"]
