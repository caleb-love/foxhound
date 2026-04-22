"""Wire-format-agnostic compression (WP05).

Mirrors ``packages/sdk/src/transport/compression.ts``. Gzip is the
default algorithm and uses the Python stdlib ``gzip`` module (no
additional dep). LZ4 is reserved in the type signature for the
low-CPU case (see RFC-005); the implementation is guarded on the
optional ``lz4`` PyPI dep, which operators install explicitly when
they want the low-CPU wire path.

Design rules (parity with the TS side):

1. Compression is all-or-nothing per batch. We do not split batches
   across compressed chunks; the SDK already batches before transport.

2. Tiny bodies skip compression. Below ``COMPRESSION_THRESHOLD_BYTES``
   (512 B uncompressed) gzip is net-negative; ``compress()`` returns
   the input unchanged and reports ``kind == "none"``.

3. ``compress()`` may downgrade the algorithm on fallback (e.g. LZ4
   requested without the dep). The caller MUST read the returned
   ``kind`` when setting the outgoing ``Content-Encoding`` header.
"""

from __future__ import annotations

import gzip
import warnings
from dataclasses import dataclass
from typing import Literal

CompressionKind = Literal["gzip", "lz4", "none"]

COMPRESSION_THRESHOLD_BYTES = 512
"""Below this many bytes, gzip header overhead beats compression savings."""


@dataclass(frozen=True)
class CompressedBody:
    """Compressed output paired with the algorithm that produced it."""

    bytes_: bytes
    kind: CompressionKind


_lz4_warning_emitted = False


def compress(body: bytes, kind: CompressionKind) -> CompressedBody:
    """Compress ``body`` with ``kind``. Returns the body unchanged when
    the algorithm is ``none``, when the body is below the compression
    threshold, or when ``lz4`` was requested without the optional dep.

    The caller MUST read ``result.kind`` (not the input ``kind``
    argument) to set the outgoing ``Content-Encoding`` header: the
    fallback paths may have downgraded the algorithm.
    """
    if kind == "none" or len(body) < COMPRESSION_THRESHOLD_BYTES:
        return CompressedBody(bytes_=body, kind="none")
    if kind == "gzip":
        # compresslevel=6 is Python's default and matches Node's zlib
        # default; parity matters for deterministic ratio tests.
        return CompressedBody(bytes_=gzip.compress(body, compresslevel=6), kind="gzip")
    # kind == "lz4". Import lazily so the dep is optional.
    try:  # pragma: no cover - tested via fallback branch
        import lz4.frame  # type: ignore[import-not-found]

        return CompressedBody(bytes_=lz4.frame.compress(body), kind="lz4")
    except ImportError:
        global _lz4_warning_emitted
        if not _lz4_warning_emitted:
            _lz4_warning_emitted = True
            warnings.warn(
                "foxhound.transport.compression: lz4 requested but the "
                "optional 'lz4' package is not installed; falling back to "
                "uncompressed. Install the `lz4` package or switch to gzip.",
                RuntimeWarning,
                stacklevel=2,
            )
        return CompressedBody(bytes_=body, kind="none")


def decompress(body: bytes, kind: CompressionKind) -> bytes:
    """Decompress ``body`` using the algorithm signaled by ``kind``.

    ``none`` is a passthrough. Invalid gzip raises
    :class:`gzip.BadGzipFile`. ``lz4`` without the optional dep also
    falls back to passthrough with a one-time warning; callers that
    need a hard error should check the source-side encoding explicitly
    before invoking decompress.
    """
    if kind == "none":
        return body
    if kind == "gzip":
        return gzip.decompress(body)
    try:  # pragma: no cover
        import lz4.frame  # type: ignore[import-not-found]

        return lz4.frame.decompress(body)
    except ImportError:
        global _lz4_warning_emitted
        if not _lz4_warning_emitted:
            _lz4_warning_emitted = True
            warnings.warn(
                "foxhound.transport.compression: lz4 decompression "
                "requested but the optional 'lz4' package is not "
                "installed; returning body unchanged.",
                RuntimeWarning,
                stacklevel=2,
            )
        return body


def compression_kind_from_header(header: str | None) -> CompressionKind:
    """Map a ``Content-Encoding`` header value to a ``CompressionKind``.

    Unknown values (``deflate``, ``br``, missing) map to ``none``.
    """
    if not header:
        return "none"
    v = header.strip().lower()
    if v == "gzip":
        return "gzip"
    if v == "lz4":
        return "lz4"
    return "none"


def _reset_lz4_warning_for_tests() -> None:
    """Expose a hook so tests can re-arm the one-time warning."""
    global _lz4_warning_emitted
    _lz4_warning_emitted = False
