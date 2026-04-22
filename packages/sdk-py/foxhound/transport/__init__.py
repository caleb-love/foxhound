"""
Wire-format-agnostic span transport for the Python SDK.

Mirrors the TypeScript SDK's `packages/sdk/src/transport/` module. Two
concrete implementations:

  * ``JsonTransport`` — legacy custom-JSON (sync + async).
  * ``ProtobufTransport`` — OTLP-aligned ``foxhound.v1.TraceBatch`` binary.

The Protobuf implementation requires generated Python bindings produced by
``buf`` (see ``packages/proto/generate.sh``). Until an operator runs the
codegen, ``ProtobufTransport`` raises ``TransportNotAvailableError`` with a
clear remediation message; ``JsonTransport`` continues to work and remains
the fallback per RFC-004's transition policy.
"""
from __future__ import annotations

from typing import Any, Literal, Optional, Protocol

WireFormat = Literal["protobuf", "json"]


class TransportNotAvailableError(RuntimeError):
    """Raised when a transport is not available in the current environment."""


class SpanTransport(Protocol):
    """Structural type every transport implements."""

    wire_format: WireFormat

    async def send(self, payload: dict[str, Any]) -> None:
        ...

    def send_sync(self, payload: dict[str, Any]) -> None:
        ...

    async def close(self) -> None:
        ...


def create_transport(
    *,
    endpoint: str,
    api_key: str,
    wire_format: WireFormat = "protobuf",
    timeout: float = 10.0,
    org_id: Optional[str] = None,
) -> SpanTransport:
    """Return a transport for the requested wire format.

    Default is ``"protobuf"`` per RFC-004. If the Protobuf bindings are not
    available in the current install (e.g. the repo was cloned without an
    operator run of ``packages/proto/generate.sh``), falls back to JSON with
    a single WARN log line. Callers that explicitly want to fail-closed can
    pass ``wire_format="protobuf"`` and catch ``TransportNotAvailableError``.
    """
    if wire_format == "json":
        from .json_transport import JsonTransport

        return JsonTransport(endpoint=endpoint, api_key=api_key, timeout=timeout)

    if wire_format == "protobuf":
        try:
            from .protobuf_transport import ProtobufTransport

            return ProtobufTransport(
                endpoint=endpoint,
                api_key=api_key,
                timeout=timeout,
                org_id=org_id,
            )
        except TransportNotAvailableError:
            # Honest fallback: JSON remains the supported legacy path.
            import logging

            logging.getLogger("foxhound").warning(
                "Foxhound: Protobuf bindings are not installed; falling back to JSON wire "
                "format. Install bindings by running `packages/proto/generate.sh` with "
                "`buf` installed. See RFC-004 for the deprecation timeline."
            )
            from .json_transport import JsonTransport

            return JsonTransport(endpoint=endpoint, api_key=api_key, timeout=timeout)

    raise ValueError(f"unknown wire_format: {wire_format!r}")


__all__ = [
    "SpanTransport",
    "WireFormat",
    "TransportNotAvailableError",
    "create_transport",
]
