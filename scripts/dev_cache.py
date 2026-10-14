#!/usr/bin/env python3
"""DEV-SET TUNING ONLY: a caching proxy in front of the Tavily API, so prompt and gate tuning on the dev set does not
spend credits on every iteration (bench/PROTOCOL.md rule 6, seed-data rule 6).

    python3 scripts/dev_cache.py --port 8787 --cache .dev-cache
    TAVILY_BASE_URL=http://127.0.0.1:8787 TAVILY_ACCESS=keyless npm run dev     # the app, pointed at the cache

The app has no replay path of its own: src/ never imports this file, and only an explicit TAVILY_BASE_URL sends
traffic here. Tranche runs, recorded samples and live use always call Tavily directly. Every replayed response carries
the header `x-awas-dev-cache: hit`, and the cache directory is git-ignored.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

UPSTREAM = "https://api.tavily.com"


def make_handler(cache: Path):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            key = hashlib.sha256(self.path.encode() + b"\n" + body).hexdigest()
            hit = cache / f"{key}.json"
            if hit.exists():
                data = json.loads(hit.read_text())
                return self._send(data["status"], data["body"].encode(), "hit")
            headers = {k: v for k, v in self.headers.items() if k.lower() in ("content-type", "authorization", "x-tavily-access-mode")}
            req = urllib.request.Request(UPSTREAM + self.path, data=body, method="POST", headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    status, payload = r.status, r.read()
            except urllib.error.HTTPError as e:
                status, payload = e.code, e.read()
            if status == 200:
                hit.write_text(json.dumps({"status": status, "body": payload.decode("utf-8", "replace")}))
            self._send(status, payload, "miss")

        def _send(self, status: int, payload: bytes, state: str):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("x-awas-dev-cache", state)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, fmt, *args):
            print(f"[dev_cache] {self.path} {args[1] if len(args) > 1 else ''}")

    return Handler


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--cache", type=Path, default=Path(".dev-cache"))
    a = ap.parse_args()
    a.cache.mkdir(parents=True, exist_ok=True)
    print(f"dev cache on http://127.0.0.1:{a.port} → {UPSTREAM} (cache {a.cache})")
    ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(a.cache)).serve_forever()


if __name__ == "__main__":
    main()
