"""foxhound CLI — local-first tooling for Fox OSS users."""

from __future__ import annotations

import argparse
import importlib.resources
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode


def _build_handler(api_url: str, api_key: str):
    """Return a request handler class configured for the given API settings."""

    html_bytes: bytes | None = None

    try:
        # Python 3.9+
        ref = importlib.resources.files("fox_sdk.static").joinpath("index.html")
        html_bytes = ref.read_bytes()
    except Exception:
        pass

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            if self.path == "/" or self.path.startswith("/?"):
                self._serve_html()
            elif self.path == "/health":
                self._respond(200, b"ok", "text/plain")
            else:
                self._respond(404, b"Not found", "text/plain")

        def _serve_html(self):
            if html_bytes is None:
                self._respond(500, b"UI assets not found", "text/plain")
                return
            # Inject config as a tiny inline script so the page knows the API URL/key
            config_script = (
                f'<script>window.__FOX_API_URL__="{api_url}";'
                f'window.__FOX_API_KEY__="{api_key}";</script>'
            )
            body = html_bytes.replace(b"</head>", config_script.encode() + b"</head>", 1)
            self._respond(200, body, "text/html; charset=utf-8")

        def _respond(self, code: int, body: bytes, content_type: str):
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):  # noqa: N802
            pass  # suppress default access log noise

    return _Handler


def cmd_ui(args: argparse.Namespace) -> None:
    api_url = args.api or os.environ.get("FOX_API_URL", "http://localhost:3001")
    api_key = args.api_key or os.environ.get("FOX_API_KEY", "")
    port = args.port
    no_open = args.no_open

    handler_cls = _build_handler(api_url, api_key)
    server = HTTPServer(("127.0.0.1", port), handler_cls)

    url = f"http://localhost:{port}"
    print(f"  Foxhound trace viewer  →  {url}")
    print(f"  API endpoint           →  {api_url}")
    print("  Press Ctrl-C to stop.\n")

    if not no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="foxhound",
        description="Foxhound — local-first OSS tooling for the Fox observability platform",
    )
    sub = parser.add_subparsers(dest="command", metavar="<command>")

    ui_parser = sub.add_parser("ui", help="Start the local trace viewer")
    ui_parser.add_argument(
        "--api",
        metavar="URL",
        help="Fox API base URL (default: $FOX_API_URL or http://localhost:3001)",
    )
    ui_parser.add_argument(
        "--api-key",
        metavar="KEY",
        help="Fox API key (default: $FOX_API_KEY)",
    )
    ui_parser.add_argument(
        "--port",
        type=int,
        default=8765,
        metavar="PORT",
        help="Local port for the viewer (default: 8765)",
    )
    ui_parser.add_argument(
        "--no-open",
        action="store_true",
        help="Do not automatically open a browser tab",
    )

    args = parser.parse_args()

    if args.command == "ui":
        cmd_ui(args)
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
