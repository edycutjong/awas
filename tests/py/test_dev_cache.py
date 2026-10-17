import json
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from conftest import run_as_main


class Upstream(BaseHTTPRequestHandler):
    seen = []

    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        Upstream.seen.append((self.path, body, dict(self.headers)))
        status = 429 if self.path == "/limited" else 200
        payload = json.dumps({"ok": status == 200}).encode()
        self.send_response(status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *a):
        pass


@pytest.fixture
def servers(script, tmp_path, monkeypatch):
    mod = script("dev_cache")
    up = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    threading.Thread(target=up.serve_forever, daemon=True).start()
    monkeypatch.setattr(mod, "UPSTREAM", f"http://127.0.0.1:{up.server_address[1]}")
    cache = tmp_path / "cache"
    cache.mkdir()
    proxy = ThreadingHTTPServer(("127.0.0.1", 0), mod.make_handler(cache))
    threading.Thread(target=proxy.serve_forever, daemon=True).start()
    Upstream.seen.clear()
    yield mod, f"http://127.0.0.1:{proxy.server_address[1]}", cache
    proxy.shutdown()
    up.shutdown()


def post(url, path, data=b'{"q":1}', headers=None):
    req = urllib.request.Request(url + path, data=data, method="POST", headers=headers or {"Content-Type": "application/json", "X-Other": "dropped"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.headers.get("x-awas-dev-cache"), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("x-awas-dev-cache"), e.read()


def test_miss_then_hit_and_only_forwards_allowed_headers(servers):
    _, url, cache = servers
    assert post(url, "/search")[:2] == (200, "miss")
    assert post(url, "/search")[:2] == (200, "hit")
    assert len(Upstream.seen) == 1
    assert "X-Other" not in Upstream.seen[0][2]
    assert len(list(cache.glob("*.json"))) == 1


def test_upstream_errors_are_passed_through_and_not_cached(servers):
    _, url, cache = servers
    assert post(url, "/limited")[:2] == (429, "miss")
    assert list(cache.glob("*.json")) == []


def test_request_without_a_body(servers):
    _, url, _ = servers
    status, state, _ = post(url, "/search", data=b"", headers={})
    assert (status, state) == (200, "miss")


def test_log_message_prints_status_when_present(servers, capsys):
    mod, _, cache = servers
    handler = mod.make_handler(cache)
    fake = type("F", (), {"path": "/x"})()
    handler.log_message(fake, "%s", "200", "OK")
    handler.log_message(fake, "only")
    out = capsys.readouterr().out
    assert "[dev_cache] /x OK" in out and "[dev_cache] /x \n" in out


def test_main_serves_on_the_given_port(script, tmp_path, monkeypatch, capsys):
    mod = script("dev_cache")
    started = {}

    class FakeServer:
        def __init__(self, addr, handler):
            started["addr"] = addr

        def serve_forever(self):
            started["served"] = True

    monkeypatch.setattr(mod, "ThreadingHTTPServer", FakeServer)
    monkeypatch.setattr("sys.argv", ["dev_cache.py", "--port", "9999", "--cache", str(tmp_path / "c")])
    mod.main()
    assert started == {"addr": ("127.0.0.1", 9999), "served": True}
    assert (tmp_path / "c").is_dir()
    assert "dev cache on http://127.0.0.1:9999" in capsys.readouterr().out


def test_runs_as_a_script():
    assert run_as_main("dev_cache", "--help") == 0
