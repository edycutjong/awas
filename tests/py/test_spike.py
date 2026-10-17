import io
import json
import sys
import urllib.error

import pytest

from conftest import FakeResp, run_as_main


@pytest.fixture
def mod(script):
    return script("spike")


def test_http_returns_status_headers_body_and_never_raises(mod, monkeypatch):
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda req, timeout=None: FakeResp(b"ok", 200, {"X": "1"}))
    st, hdr, body, secs = mod.http("GET", "https://x.example", {})
    assert (st, hdr, body) == (200, {"X": "1"}, b"ok") and secs >= 0

    def http_error(req, timeout=None):
        raise urllib.error.HTTPError("u", 412, "m", {"ETag": "e"}, io.BytesIO(b"nope"))

    monkeypatch.setattr(mod.urllib.request, "urlopen", http_error)
    assert mod.http("PUT", "https://x.example", {}, b"x")[:3] == (412, {"ETag": "e"}, b"nope")

    def http_error_no_headers(req, timeout=None):
        raise urllib.error.HTTPError("u", 500, "m", None, io.BytesIO(b""))

    monkeypatch.setattr(mod.urllib.request, "urlopen", http_error_no_headers)
    assert mod.http("GET", "https://x.example", {})[:2] == (500, {})

    def boom(req, timeout=None):
        raise OSError("down")

    monkeypatch.setattr(mod.urllib.request, "urlopen", boom)
    assert mod.http("GET", "https://x.example", {})[:3] == (0, {}, b"down")


def test_mask_phones(mod):
    masked = mod.mask_phones("call 0812 3456 7890 now")
    assert "7890" in masked and "3456" not in masked


def test_tf_body_variants(mod):
    raw = mod.tf_body("m", "json_schema_raw", "low_effort")
    assert raw["response_format"]["json_schema"] == mod.SCHEMA and raw["chat_template_kwargs"] == {"enable_thinking": True, "low_effort": True}
    named = mod.tf_body("m", "json_schema_named", "effort_low")
    assert named["response_format"]["json_schema"]["strict"] is True and named["reasoning_effort"] == "low"
    obj = mod.tf_body("m", "json_object", "off")
    assert obj["response_format"] == {"type": "json_object"} and obj["chat_template_kwargs"] == {"enable_thinking": False}
    none = mod.tf_body("m", "json_object", "default")
    assert "chat_template_kwargs" not in none and "reasoning_effort" not in none


def test_parse_json(mod):
    assert mod.parse_json('<think>x</think> {"a": 1} tail') == {"a": 1}
    assert mod.parse_json(None) is None
    assert mod.parse_json("no braces") is None
    assert mod.parse_json("{not json}") is None


def complete_reply(content='{"is_job_offer": true, "company": "PT X", "destination": null, "job": null, "visa": "turis", "fees": [], "promises": []}', status=200):
    body = {"id": "r", "choices": [{"finish_reason": "stop", "message": {"content": content}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 2, "completion_tokens_details": {"reasoning_tokens": 3}}}
    return (status, {}, json.dumps(body).encode(), 0.5)


def test_spike_tf_records_every_variant(mod, monkeypatch, capsys):
    replies = {
        "models": (200, {}, json.dumps({"data": [{"id": "nvidia/nemotron-x"}, {"id": "other/y"}]}).encode(), 0.1),
    }
    chat_replies = iter([
        complete_reply(), complete_reply(content=None), complete_reply(status=400), (200, {}, b"<html>", 0.2),
        (200, {}, json.dumps({"choices": [None]}).encode(), 0.1),
    ])

    def fake_http(method, url, headers, body=None, timeout=120):
        if url.endswith("/models"):
            return replies["models"]
        return next(chat_replies, complete_reply())

    monkeypatch.setattr(mod, "http", fake_http)
    out = mod.spike_tf("k", ["nvidia/a"], ["json_object", "json_schema_raw"])
    assert out["models_endpoint"]["count"] == 2 and out["models_endpoint"]["nvidia"] == ["nvidia/nemotron-x", "other/y"][:1]
    assert len(out["runs"]) == 6
    first = out["runs"][0]
    assert first["parsed"] is True and first["schema_keys_ok"] is True and first["reasoning_tokens"] == 3 and first["error"] is None
    assert out["runs"][1]["parsed"] is False
    assert out["runs"][2]["error"] is not None
    assert out["runs"][3]["parsed"] is False and "html" in out["runs"][3]["error"]
    assert "TF " in capsys.readouterr().err


def test_spike_tf_survives_a_bad_models_listing(mod, monkeypatch):
    monkeypatch.setattr(mod, "http", lambda m, u, h, b=None, t=120: (500, {}, b"nope", 0.1) if u.endswith("/models") else complete_reply())
    out = mod.spike_tf("k", ["nvidia/a"], ["json_object"])
    assert out["models_endpoint"]["count"] == 0


def test_sigv4_put_signs_and_sends(mod, monkeypatch):
    sent = {}

    def fake_http(method, url, headers, body=None, timeout=120):
        sent.update(method=method, url=url, headers=headers, body=body)
        return 200, {}, b"", 0.1

    monkeypatch.setattr(mod, "http", fake_http)
    mod.sigv4_put("https://storage.r.nebius.cloud", "r", "bucket", "k.json", b"{}", "AK", "SK", {"If-None-Match": "*"})
    assert sent["method"] == "PUT" and sent["url"] == "https://storage.r.nebius.cloud/bucket/k.json"
    assert "host" not in sent["headers"] and sent["headers"]["if-none-match"] == "*"
    assert sent["headers"]["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=AK/")


def test_spike_storage(mod, monkeypatch, capsys):
    for k in ("NEBIUS_BUCKET", "NEBIUS_S3_ACCESS_KEY_ID", "NEBIUS_S3_SECRET_ACCESS_KEY", "NEBIUS_REGION"):
        monkeypatch.delenv(k, raising=False)
    assert "skipped" in mod.spike_storage()
    monkeypatch.setenv("NEBIUS_BUCKET", "b")
    monkeypatch.setenv("NEBIUS_S3_ACCESS_KEY_ID", "a")
    monkeypatch.setenv("NEBIUS_S3_SECRET_ACCESS_KEY", "s")
    statuses = iter([(200, {"ETag": "e1"}, b"", 0.1), (412, {"etag": "e2"}, b"", 0.1)])
    monkeypatch.setattr(mod, "sigv4_put", lambda *a: next(statuses))
    res = mod.spike_storage()
    assert res["conditional_create_works"] is True and res["region"] == "eu-west1" and res["puts"][1]["etag"] == "e2"
    statuses = iter([(200, {}, b"", 0.1), (200, {}, b"", 0.1)])
    monkeypatch.setattr(mod, "sigv4_put", lambda *a: next(statuses))
    monkeypatch.setenv("NEBIUS_REGION", "uk-south1")
    res = mod.spike_storage()
    assert res["conditional_create_works"] is False and res["puts"][0]["etag"] is None and res["region"] == "uk-south1"


def test_spike_tavily_keyed_and_keyless(mod, monkeypatch):
    calls = []
    search = {"results": [{"url": "https://kemlu.go.id/a", "raw_content": "abc"}, {"url": "https://news.example/b"}], "usage": {"credits": 1}, "request_id": "r"}
    extract = {"results": [{"raw_content": "a [...] b"}, {}], "usage": {"credits": 1}, "failed_results": []}

    def fake_http(method, url, headers, body=None, timeout=120):
        calls.append(headers)
        return (200, {}, json.dumps(search if url.endswith("/search") else extract).encode(), 0.1)

    monkeypatch.setattr(mod, "http", fake_http)
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    out = mod.spike_tavily()
    assert out["access"] == "keyless" and calls[0]["X-Tavily-Access-Mode"] == "keyless"
    assert [c["method"] for c in out["calls"]] == ["search", "extract"] and out["calls"][1]["chunks"] == [2, 1]
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-k")
    out = mod.spike_tavily()
    assert out["access"] == "key" and calls[-1]["Authorization"] == "Bearer tvly-k"


def test_spike_tavily_fallbacks(mod, monkeypatch):
    seq = iter([(200, {}, json.dumps({"results": [{"url": "https://news.example/b"}]}).encode(), 0.1), (500, {}, b"x", 0.1)])
    monkeypatch.setattr(mod, "http", lambda *a, **k: next(seq))
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    out = mod.spike_tavily()
    assert out["calls"][1]["status"] == 500 and out["calls"][1]["chunks"] == []
    monkeypatch.setattr(mod, "http", lambda *a, **k: (500, {}, b"x", 0.1))
    assert len(mod.spike_tavily()["calls"]) == 1


def run_main(mod, monkeypatch, tmp_path, *flags, tf_key="k"):
    out = tmp_path / "spike.json"
    monkeypatch.setattr(sys, "argv", ["spike", "--out", str(out), *flags])
    if tf_key:
        monkeypatch.setenv("TOKENFACTORY_API_KEY", tf_key)
    else:
        monkeypatch.delenv("TOKENFACTORY_API_KEY", raising=False)
    monkeypatch.setattr(mod, "spike_tf", lambda key, models, formats: {"key": key, "models": models, "formats": formats})
    monkeypatch.setattr(mod, "spike_storage", lambda: {"storage": True})
    monkeypatch.setattr(mod, "spike_tavily", lambda: {"tavily": True})
    assert mod.main() == 0
    return json.loads(out.read_text())


def test_main_combinations(mod, monkeypatch, tmp_path):
    full = run_main(mod, monkeypatch, tmp_path)
    assert full["token_factory"]["key"] == "k" and full["object_storage"] == {"storage": True} and full["tavily"] == {"tavily": True}
    tf_only = run_main(mod, monkeypatch, tmp_path, "--tf-only", "--models", "m1", "--formats", "json_object")
    assert "object_storage" not in tf_only and tf_only["token_factory"]["models"] == ["m1"]
    assert "skipped" in run_main(mod, monkeypatch, tmp_path, "--skip-tf")["token_factory"]
    assert "skipped" in run_main(mod, monkeypatch, tmp_path, tf_key=None)["token_factory"]


def test_runs_as_a_script():
    assert run_as_main("spike", "--help") == 0
