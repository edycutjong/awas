import io
import json
import sys
import urllib.error

import pytest

from conftest import FakeResp, run_as_main

LONG = "<html><head><style>x{}</style><script>var a=1;</script></head><body><p>" + ("Kalimat pengisi yang cukup panjang. " * 20) + "</p><p>PT Maju Jaya diduga <b>merekrut</b> korban.</p><!-- c --></body></html>"


@pytest.fixture
def mod(script):
    return script("verify_quotes")


def test_norm_folds_quotes_dashes_and_zero_width(mod):
    assert mod.norm("  “Hello”  ‘x’ – a​b \n c ") == "\"hello\" 'x' - ab c"


def test_tls_context_uses_certifi_when_available(mod, monkeypatch):
    monkeypatch.setitem(sys.modules, "certifi", type(sys)("certifi"))
    sys.modules["certifi"].where = lambda: "/nonexistent.pem"
    assert mod._tls_context() is None  # an unreadable bundle falls back to the default store
    monkeypatch.setattr("ssl.create_default_context", lambda cafile=None: "ctx")
    assert mod._tls_context() == "ctx"
    monkeypatch.setitem(sys.modules, "certifi", None)
    assert mod._tls_context() is None


def test_page_text_strips_markup_and_reports_failures(mod, monkeypatch):
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda *a, **k: FakeResp(LONG, headers={"Content-Type": "text/html"}))
    status, text = mod.page_text("https://x.example")
    assert status == 200 and "PT Maju Jaya diduga merekrut korban." in text and "var a" not in text
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda *a, **k: FakeResp(b"%PDF", headers={"Content-Type": "application/pdf"}))
    assert mod.page_text("https://x.example/a.pdf") == (200, "")

    def http_error(*a, **k):
        raise urllib.error.HTTPError("u", 404, "nf", {}, io.BytesIO(b""))

    monkeypatch.setattr(mod.urllib.request, "urlopen", http_error)
    assert mod.page_text("https://x.example") == (404, "")

    def boom(*a, **k):
        raise OSError("net")

    monkeypatch.setattr(mod.urllib.request, "urlopen", boom)
    assert mod.page_text("https://x.example") == (0, "")


def test_tavily_text_with_and_without_key(mod, monkeypatch):
    seen = []

    def fake(req, timeout=None):
        seen.append(req.headers)
        return FakeResp(json.dumps({"results": [{"raw_content": "page"}]}))

    monkeypatch.setattr(mod.urllib.request, "urlopen", fake)
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    assert mod.tavily_text("u") == "page"
    assert seen[-1]["X-tavily-access-mode"] == "keyless"
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-k")
    assert mod.tavily_text("u") == "page"
    assert seen[-1]["Authorization"] == "Bearer tvly-k"
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda *a, **k: FakeResp(json.dumps({"results": []})))
    assert mod.tavily_text("u") == ""


def test_check_line_verdicts(mod, monkeypatch):
    line = {"quote": "PT Maju Jaya diduga merekrut korban", "url": "u"}
    monkeypatch.setattr(mod, "page_text", lambda url: (200, mod.re.sub(r"<[^>]+>", "", LONG)))
    assert mod.check_line(line, False) == "present"
    # words split differently by markup: present once spaces are ignored
    monkeypatch.setattr(mod, "page_text", lambda url: (200, "x" * 500 + " PT Maju Jaya did uga merekrut korban"))
    assert mod.check_line(line, False) == "present"
    monkeypatch.setattr(mod, "page_text", lambda url: (200, "y " * 1500))
    assert mod.check_line(line, False) == "changed since fetch"
    monkeypatch.setattr(mod, "page_text", lambda url: (200, "z " * 300))
    assert mod.check_line(line, False) == "unverifiable by plain GET"
    monkeypatch.setattr(mod, "page_text", lambda url: (200, "short"))
    assert mod.check_line(line, False) == "unverifiable by plain GET"
    monkeypatch.setattr(mod, "page_text", lambda url: (500, ""))
    assert mod.check_line(line, False) == "unverifiable by plain GET"
    monkeypatch.setattr(mod, "tavily_text", lambda url: "contains PT Maju Jaya diduga merekrut korban here")
    assert mod.check_line(line, True) == "present"
    monkeypatch.setattr(mod, "tavily_text", lambda url: "nothing")
    assert mod.check_line(line, True) == "changed since fetch"


def test_load_packs_from_bench_file_pack_file_and_url(mod, tmp_path, monkeypatch):
    bench = tmp_path / "b.jsonl"
    bench.write_text(json.dumps({"full_pack": {"lines": []}}) + "\n\n" + json.dumps({}) + "\n")
    assert mod.load_packs(str(bench), True) == [{"lines": []}, {}]
    pack = tmp_path / "p.json"
    pack.write_text(json.dumps({"lines": [1]}))
    assert mod.load_packs(str(pack), False) == [{"lines": [1]}]
    urls = []

    def fake(req, timeout=None):
        urls.append(req.full_url)
        return FakeResp(json.dumps({"lines": []}))

    monkeypatch.setattr(mod.urllib.request, "urlopen", fake)
    mod.load_packs("https://awas.example/case/abc", False)
    mod.load_packs("https://awas.example/api/case/abc", False)
    assert urls == ["https://awas.example/api/case/abc", "https://awas.example/api/case/abc"]


def test_main_prints_verdict_counts_and_handles_empty(mod, tmp_path, monkeypatch, capsys):
    pack = tmp_path / "p.json"
    pack.write_text(json.dumps({"lines": [
        {"status": "dropped", "quote": "q", "url": "u"},
        {"status": "verified", "quote": "q" * 200, "url": "https://x.example/" + "a" * 100},
    ]}))
    monkeypatch.setattr(mod, "check_line", lambda line, t: "present")
    monkeypatch.setattr(sys, "argv", ["v", str(pack)])
    assert mod.main() == 0
    assert "present: 1" in capsys.readouterr().out
    empty = tmp_path / "e.json"
    empty.write_text("{}")
    monkeypatch.setattr(sys, "argv", ["v", str(empty), "--tavily"])
    assert mod.main() == 0
    assert "no shown lines" in capsys.readouterr().out


def test_runs_as_a_script():
    assert run_as_main("verify_quotes", "--help") == 0
