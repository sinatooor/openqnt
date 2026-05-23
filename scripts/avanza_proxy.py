"""
mitmproxy addon — captures all avanza.se API traffic to avanza_capture.jsonl
Run with:
    mitmdump -s scripts/avanza_proxy.py --listen-port 8080 --ssl-insecure
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path

import mitmproxy.http

CAPTURE_FILE = Path(__file__).parent / "avanza_capture.jsonl"
AVANZA_API_RE = re.compile(r"avanza\.se/(_api|_cqrs|_push)", re.IGNORECASE)

# Headers we especially care about
KEY_REQUEST_HEADERS = {
    "x-securitytoken", "x-azacsrf", "x-aza-transactionid",
    "cookie", "authorization", "content-type", "accept",
    "referer", "origin", "user-agent",
}
KEY_RESPONSE_HEADERS = {
    "x-securitytoken", "set-cookie", "content-type",
}


def _headers_dict(headers) -> dict:
    return {k.lower(): v for k, v in headers.items()}


class AvanzaCapture:
    def __init__(self):
        CAPTURE_FILE.write_text("")  # clear on startup
        print(f"\n{'='*60}")
        print("Avanza proxy capture started")
        print(f"Saving to: {CAPTURE_FILE}")
        print(f"{'='*60}\n")

    def request(self, flow: mitmproxy.http.HTTPFlow) -> None:
        if not AVANZA_API_RE.search(flow.request.pretty_url):
            return

        req_headers = _headers_dict(flow.request.headers)
        try:
            body = json.loads(flow.request.content) if flow.request.content else None
        except Exception:
            body = flow.request.content.decode("utf-8", errors="replace") if flow.request.content else None

        entry = {
            "ts": datetime.utcnow().isoformat(),
            "direction": "REQUEST",
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "path": flow.request.path,
            "headers": {k: v for k, v in req_headers.items() if k in KEY_REQUEST_HEADERS},
            "all_headers": req_headers,
            "body": body,
        }
        self._write(entry)
        print(f"→ {flow.request.method:6} {flow.request.path}")

    def response(self, flow: mitmproxy.http.HTTPFlow) -> None:
        if not AVANZA_API_RE.search(flow.request.pretty_url):
            return

        resp_headers = _headers_dict(flow.response.headers)
        try:
            body = json.loads(flow.response.content) if flow.response.content else None
        except Exception:
            body = flow.response.content.decode("utf-8", errors="replace")[:500] if flow.response.content else None

        entry = {
            "ts": datetime.utcnow().isoformat(),
            "direction": "RESPONSE",
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "path": flow.request.path,
            "status": flow.response.status_code,
            "headers": {k: v for k, v in resp_headers.items() if k in KEY_RESPONSE_HEADERS},
            "all_headers": resp_headers,
            "body": body,
        }
        self._write(entry)
        status = flow.response.status_code
        icon = "✓" if status < 400 else "✗"
        print(f"  {icon} {status} ← {flow.request.path}")

    def _write(self, entry: dict) -> None:
        with CAPTURE_FILE.open("a") as f:
            f.write(json.dumps(entry) + "\n")


addons = [AvanzaCapture()]
