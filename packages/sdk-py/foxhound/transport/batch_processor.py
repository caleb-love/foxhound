"""BatchSpanProcessor-equivalent export queue for the Python SDK."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import deque
from typing import Any, Callable, Literal

from . import SpanTransport

BackpressurePolicy = Literal["block", "drop-oldest", "drop-newest"]
DropCallback = Callable[[dict[str, Any], Literal["queue-full"]], None]

_logger = logging.getLogger("foxhound.batch_processor")


def _default_on_drop(payload: dict[str, Any], reason: Literal["queue-full"]) -> None:
    _logger.warning(
        "[foxhound/batch-processor] trace %s dropped (%s); increase max_queue_size "
        "or reduce export rate to avoid loss.",
        payload.get("id"),
        reason,
    )


class BatchSpanProcessor:
    """Bounded background trace exporter.

    Defaults intentionally match Pendo's OpenTelemetry BatchSpanProcessor shape
    for WP06: batch size 512 and schedule delay 2 seconds.
    """

    def __init__(
        self,
        *,
        transport: SpanTransport,
        max_queue_size: int = 2048,
        max_export_batch_size: int = 512,
        schedule_delay_s: float = 2.0,
        backpressure_policy: BackpressurePolicy = "drop-oldest",
        on_drop: DropCallback | None = None,
    ) -> None:
        if max_queue_size < 1:
            raise ValueError("max_queue_size must be at least 1")
        if max_export_batch_size < 1:
            raise ValueError("max_export_batch_size must be at least 1")
        self._transport = transport
        self._max_queue_size = max_queue_size
        self._max_export_batch_size = max_export_batch_size
        self._schedule_delay_s = schedule_delay_s
        self._backpressure_policy = backpressure_policy
        self._on_drop = on_drop or _default_on_drop

        self._queue: deque[dict[str, Any]] = deque()
        self._condition = threading.Condition()
        self._closed = False
        self._in_flight = 0
        self._worker = threading.Thread(
            target=self._run,
            name="foxhound-batch-span-processor",
            daemon=True,
        )
        self._worker.start()

    @property
    def queue_depth(self) -> int:
        with self._condition:
            return len(self._queue)

    def enqueue(self, payload: dict[str, Any]) -> None:
        with self._condition:
            if self._closed:
                return

            if len(self._queue) >= self._max_queue_size:
                if self._backpressure_policy == "drop-oldest":
                    dropped = self._queue.popleft()
                    self._on_drop(dropped, "queue-full")
                elif self._backpressure_policy == "drop-newest":
                    self._on_drop(payload, "queue-full")
                    return
                else:
                    self._condition.notify_all()
                    while len(self._queue) >= self._max_queue_size and not self._closed:
                        self._condition.wait(timeout=self._schedule_delay_s)
                    if self._closed:
                        return

            self._queue.append(payload)
            if len(self._queue) >= self._max_export_batch_size:
                self._condition.notify_all()

    def flush(self, timeout_s: float = 5.0) -> bool:
        deadline = time.monotonic() + max(timeout_s, 0.0)
        with self._condition:
            self._condition.notify_all()
            while self._queue or self._in_flight:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                self._condition.wait(timeout=remaining)
            return True

    def shutdown(self, timeout_s: float = 5.0) -> bool:
        deadline = time.monotonic() + max(timeout_s, 0.0)
        with self._condition:
            self._closed = True
            self._condition.notify_all()

        drained = self.flush(timeout_s=timeout_s)
        remaining = max(0.0, deadline - time.monotonic())
        if remaining > 0:
            self._worker.join(timeout=remaining)
        self._close_transport()
        return drained

    def _run(self) -> None:
        while True:
            with self._condition:
                while not self._closed and not self._queue:
                    self._condition.wait(timeout=self._schedule_delay_s)
                if self._closed and not self._queue:
                    self._condition.notify_all()
                    return
                if not self._queue:
                    continue

                batch: list[dict[str, Any]] = []
                while self._queue and len(batch) < self._max_export_batch_size:
                    batch.append(self._queue.popleft())
                self._in_flight += len(batch)
                self._condition.notify_all()

            for payload in batch:
                try:
                    self._transport.send_sync(payload)
                except Exception:  # pragma: no cover, warning path only
                    _logger.exception(
                        "[foxhound/batch-processor] export failed for trace %s",
                        payload.get("id"),
                    )

            with self._condition:
                self._in_flight -= len(batch)
                self._condition.notify_all()

    def _close_transport(self) -> None:
        close_sync = getattr(self._transport, "close_sync", None)
        if callable(close_sync):
            close_sync()
            return
        close = getattr(self._transport, "close", None)
        if callable(close):
            try:
                asyncio.run(close())
            except RuntimeError:
                # If shutdown is called from a running event loop, the current
                # transports have no persistent resources to close. Avoid a
                # nested event-loop failure at process exit.
                return


__all__ = ["BackpressurePolicy", "BatchSpanProcessor"]
