"""
Protobuf transport for the Foxhound Python SDK.

Mirrors ``packages/sdk/src/transport/protobuf.ts``. Encodes the Foxhound
internal trace shape into a ``foxhound.v1.TraceBatch`` Protobuf message
and POSTs the binary body to ``POST /v1/traces`` with
``Content-Type: application/x-protobuf``.

**Install requirement.** This module depends on Python bindings generated
from ``packages/proto/proto/v1/*.proto`` via ``buf``. Until an operator
runs ``packages/proto/generate.sh``, the bindings are not on disk and this
module raises ``TransportNotAvailableError`` at import / construction time.
That is the deliberate partial-completion posture of WP04: the TS SDK is
fully Protobuf; the Python SDK follows once Python codegen lands.

See ``packages/proto/README.md`` for the one-command regen path.
"""
from __future__ import annotations

from typing import Any, Optional

from . import TransportNotAvailableError

# ---------------------------------------------------------------------------
# Deferred import of generated Protobuf bindings.
#
# Expected layout after `packages/proto/generate.sh` runs:
#   packages/sdk-py/foxhound/_proto/v1/span_pb2.py
#   packages/sdk-py/foxhound/_proto/v1/trace_batch_pb2.py
#
# Until then, the import fails cleanly and the factory falls back to JSON.
# ---------------------------------------------------------------------------

try:  # pragma: no cover - guarded at runtime
    from foxhound._proto.v1 import trace_batch_pb2 as _tb  # type: ignore[import-not-found]
    from foxhound._proto.v1 import span_pb2 as _sp  # type: ignore[import-not-found]

    _BINDINGS_AVAILABLE = True
except ImportError:  # pragma: no cover - expected on fresh clone
    _tb = None  # type: ignore[assignment]
    _sp = None  # type: ignore[assignment]
    _BINDINGS_AVAILABLE = False


class ProtobufTransport:
    wire_format = "protobuf"

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        timeout: float = 10.0,
        org_id: Optional[str] = None,
    ) -> None:
        if not _BINDINGS_AVAILABLE:
            raise TransportNotAvailableError(
                "Foxhound Python Protobuf bindings are not installed. "
                "Run `packages/proto/generate.sh` with `buf` installed to "
                "produce them, or pass `wire_format=\"json\"` to the client. "
                "See RFC-004 for the deprecation timeline."
            )
        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout
        self._org_id = org_id or ""

    # ------------------------------------------------------------------
    # Encoding
    # ------------------------------------------------------------------

    def _encode_batch(self, payload: dict[str, Any]) -> bytes:  # pragma: no cover
        """Encode an SDK-side ``Trace`` dict into a TraceBatch Protobuf.

        This is intentionally a stub surface; the real encoding lands once
        the Python bindings exist. The TS reference is in
        ``packages/sdk/src/transport/map.ts`` — the Python version mirrors it
        line-for-line (span_kind map, status map, ms→ns conversion, attribute
        packing). See RFC-004.
        """
        raise NotImplementedError(
            "Protobuf encoding will land with the Python bindings in a "
            "follow-up operator step. Use wire_format='json' until then."
        )

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    async def send(self, payload: dict[str, Any]) -> None:  # pragma: no cover
        import httpx

        body = self._encode_batch(payload)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/traces",
                content=body,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/x-protobuf",
                    "X-Foxhound-Wire": "protobuf",
                    "X-Foxhound-Schema": "v1",
                },
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound SDK (Protobuf): failed to ingest trace "
                f"{payload.get('id')}: {response.status_code} {response.text}"
            )

    def send_sync(self, payload: dict[str, Any]) -> None:  # pragma: no cover
        import httpx

        body = self._encode_batch(payload)
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self._endpoint}/v1/traces",
                content=body,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/x-protobuf",
                    "X-Foxhound-Wire": "protobuf",
                    "X-Foxhound-Schema": "v1",
                },
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound SDK (Protobuf): failed to ingest trace "
                f"{payload.get('id')}: {response.status_code} {response.text}"
            )

    async def close(self) -> None:
        return None
