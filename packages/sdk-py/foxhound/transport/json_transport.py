"""
Legacy JSON transport for the Foxhound Python SDK.

Preserves the exact wire shape the API has always accepted at
``POST /v1/traces`` with ``Content-Type: application/json``. Retained for
the WP04 transition window defined in RFC-004.

WP05 additions:
  * Per-span size cap applied via ``enforce_cap_on_spans`` pre-serialize.
  * Body compressed via ``compress()`` (gzip default) and the matching
    ``Content-Encoding`` header set when the compressor actually ran.
  * 64 KB compressed chunk ceiling enforced pre-send.

Backward compat: when ``compression="none"`` (explicit opt-out), the
body remains a UTF-8 string and no ``Content-Encoding`` header is sent,
matching the pre-WP05 shape exactly.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable

import httpx

from .compression import CompressionKind, compress
from .size_cap import (
    DropRecord,
    MAX_COMPRESSED_CHUNK_BYTES,
    enforce_cap_on_spans,
)

_logger = logging.getLogger("foxhound.transport.json")


def _default_on_drop(record: DropRecord) -> None:
    _logger.warning(
        "[foxhound/size-cap] (json) dropped payload for span %s (trace %s, org %s): "
        "%d B -> %d B retained; fields=%s",
        record.span_id,
        record.trace_id,
        record.org_id,
        record.original_bytes,
        record.retained_bytes,
        ",".join(record.dropped_fields),
    )


class JsonTransport:
    wire_format = "json"

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        timeout: float = 10.0,
        org_id: str | None = None,
        compression: CompressionKind = "gzip",
        on_drop: Callable[[DropRecord], None] | None = None,
    ) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout
        self._org_id = org_id or ""
        self._compression: CompressionKind = compression
        self._on_drop: Callable[[DropRecord], None] = on_drop or _default_on_drop

    def _headers(self, actual_compression: CompressionKind) -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-Foxhound-Wire": "json",
        }
        if actual_compression != "none":
            headers["Content-Encoding"] = actual_compression
        return headers

    def _prepare(self, payload: dict[str, Any]) -> tuple[str | bytes, CompressionKind, int]:
        """Apply size-cap + compression. Returns (body, actual_kind, byte_count).

        ``body`` is a ``str`` when compression downgraded to ``none`` so the
        legacy test surface keeps working, and ``bytes`` when the compressor
        actually ran.
        """
        spans = list(payload.get("spans", []) or [])
        capped_spans = enforce_cap_on_spans(spans, self._org_id, self._on_drop)
        if capped_spans is not spans:
            payload = {**payload, "spans": capped_spans}
        json_str = json.dumps(payload)
        uncompressed = json_str.encode("utf-8")
        result = compress(uncompressed, self._compression)
        if len(result.bytes_) > MAX_COMPRESSED_CHUNK_BYTES:
            raise RuntimeError(
                f"Foxhound SDK (JSON): compressed batch is {len(result.bytes_)} B "
                f"> {MAX_COMPRESSED_CHUNK_BYTES} B ceiling. See RFC-005."
            )
        body: str | bytes = json_str if result.kind == "none" else result.bytes_
        return body, result.kind, len(result.bytes_)

    async def send(self, payload: dict[str, Any]) -> None:
        body, kind, _ = self._prepare(payload)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            # httpx selects the right body path based on type: str →
            # JSON-with-encoding header; bytes → raw payload.
            if isinstance(body, bytes):
                response = await client.post(
                    f"{self._endpoint}/v1/traces",
                    content=body,
                    headers=self._headers(kind),
                )
            else:
                response = await client.post(
                    f"{self._endpoint}/v1/traces",
                    content=body,
                    headers=self._headers(kind),
                )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound SDK (JSON): failed to ingest trace "
                f"{payload.get('id')}: {response.status_code} {response.text}"
            )

    def send_sync(self, payload: dict[str, Any]) -> None:
        body, kind, _ = self._prepare(payload)
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self._endpoint}/v1/traces",
                content=body,
                headers=self._headers(kind),
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound SDK (JSON): failed to ingest trace "
                f"{payload.get('id')}: {response.status_code} {response.text}"
            )

    async def close(self) -> None:
        return None
