"""Unit tests for FoxhoundClient, focusing on the onBudgetExceeded callback."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from foxhound.client import BudgetExceededInfo, FoxhoundClient


def _make_response(
    status_code: int = 200,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    """Build a fake httpx.Response with the given status code and headers."""
    return httpx.Response(
        status_code=status_code,
        headers=headers or {},
        request=httpx.Request("POST", "https://api.example.com/v1/traces"),
    )


# ---------------------------------------------------------------------------
# onBudgetExceeded — async path
# ---------------------------------------------------------------------------


class TestOnBudgetExceededAsync:
    @pytest.mark.asyncio
    async def test_invokes_callback_when_budget_exceeded(self) -> None:
        callback = MagicMock()

        response = _make_response(
            headers={
                "x-foxhound-budget-status": "exceeded",
                "x-foxhound-budget-agent-id": "agent_42",
                "x-foxhound-budget-current-cost": "150.75",
                "x-foxhound-budget-limit": "100.00",
            },
        )

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            on_budget_exceeded=callback,
            max_queue_size=0,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response):
            tracer = client.start_trace(agent_id="agent_42")
            span = tracer.start_span(name="step", kind="agent_step")
            span.end()
            await tracer.flush()

        callback.assert_called_once_with(
            BudgetExceededInfo(
                agent_id="agent_42",
                current_cost=150.75,
                budget_limit=100.00,
            )
        )

    @pytest.mark.asyncio
    async def test_does_not_invoke_callback_when_status_absent(self) -> None:
        callback = MagicMock()

        response = _make_response()

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            on_budget_exceeded=callback,
            max_queue_size=0,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response):
            tracer = client.start_trace(agent_id="agent_1")
            span = tracer.start_span(name="step", kind="agent_step")
            span.end()
            await tracer.flush()

        callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_invoke_callback_when_status_is_ok(self) -> None:
        callback = MagicMock()

        response = _make_response(
            headers={"x-foxhound-budget-status": "ok"},
        )

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            on_budget_exceeded=callback,
            max_queue_size=0,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response):
            tracer = client.start_trace(agent_id="agent_1")
            span = tracer.start_span(name="step", kind="agent_step")
            span.end()
            await tracer.flush()

        callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_error_when_callback_not_configured(self) -> None:
        response = _make_response(
            headers={
                "x-foxhound-budget-status": "exceeded",
                "x-foxhound-budget-agent-id": "agent_1",
                "x-foxhound-budget-current-cost": "200",
                "x-foxhound-budget-limit": "100",
            },
        )

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            max_queue_size=0,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response):
            tracer = client.start_trace(agent_id="agent_1")
            span = tracer.start_span(name="step", kind="agent_step")
            span.end()
            await tracer.flush()  # should not raise

    @pytest.mark.asyncio
    async def test_defaults_agent_id_when_header_missing(self) -> None:
        callback = MagicMock()

        response = _make_response(
            headers={
                "x-foxhound-budget-status": "exceeded",
                "x-foxhound-budget-current-cost": "50",
                "x-foxhound-budget-limit": "25",
            },
        )

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            on_budget_exceeded=callback,
            max_queue_size=0,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response):
            tracer = client.start_trace(agent_id="agent_1")
            span = tracer.start_span(name="step", kind="agent_step")
            span.end()
            await tracer.flush()

        callback.assert_called_once_with(
            BudgetExceededInfo(
                agent_id="",
                current_cost=50.0,
                budget_limit=25.0,
            )
        )


# ---------------------------------------------------------------------------
# onBudgetExceeded — sync path
# ---------------------------------------------------------------------------


class TestOnBudgetExceededSync:
    def test_invokes_callback_on_sync_send(self) -> None:
        callback = MagicMock()

        response = _make_response(
            headers={
                "x-foxhound-budget-status": "exceeded",
                "x-foxhound-budget-agent-id": "agent_sync",
                "x-foxhound-budget-current-cost": "75.50",
                "x-foxhound-budget-limit": "50.00",
            },
        )

        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            on_budget_exceeded=callback,
            max_queue_size=0,
        )

        with patch("httpx.Client.post", return_value=response):
            client._send_trace_sync({"id": "trace_1", "agentId": "agent_sync", "spans": []})

        callback.assert_called_once_with(
            BudgetExceededInfo(
                agent_id="agent_sync",
                current_cost=75.50,
                budget_limit=50.00,
            )
        )
