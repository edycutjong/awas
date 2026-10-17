import json
import sys

import pytest

from conftest import FakeResp, run_as_main

LINE = {"status": "verified", "purpose": "company", "entity": True, "entityCapped": False, "entityKind": "company", "negative": True, "guard": False,
        "url": "https://a.example/1", "quote": "q", "pageSha256": "h"}


def make_pack(case_id, verdict="STOP", lines=None, flags=None, picker=True, errors=(), ms=2000):
    return {
        "id": case_id, "verdict": verdict, "rule": "r", "flags": flags if flags is not None else [{"id": "tourist_visa", "class": "NEVER"}, {"id": "fee_asked", "class": "CAUTION"}],
        "lines": [LINE] if lines is None else lines, "tavily": [{"error": e} for e in errors],
        "picker": {"verdict": "STOP", "companyMatched": True} if picker else None,
        "receipt": {"failedSteps": [], "tf": [{"error": None}], "ms": ms, "tfTokens": 10, "tavilyCredits": 2},
    }


@pytest.fixture
def mod(script, monkeypatch):
    m = script("bench")
    monkeypatch.setattr(m.time, "sleep", lambda s: None)
    return m


class App:
    """A fake Awas: POST /api/check answers with an SSE stream built by `plan(body, n)`; GET /api/case/<id> serves packs."""

    def __init__(self, plan):
        self.plan, self.packs, self.bodies, self.n = plan, {}, [], 0

    def __call__(self, req, timeout=None):
        if hasattr(req, "full_url") and req.full_url.endswith("/api/check"):
            body = json.loads(req.data)
            self.bodies.append(body)
            self.n += 1
            result = self.plan(body, self.n)
            if isinstance(result, Exception):
                raise result
            if result is None:
                return FakeResp("event: started\ndata: {}\n\n")
            self.packs[result["id"]] = result
            return FakeResp("event: started\ndata: {}\n\nevent: done\ndata: " + json.dumps({"caseId": result["id"]}) + "\n\n")
        url = req if isinstance(req, str) else req.full_url
        if "/api/case/" in url:
            case = self.packs.get(url.rsplit("/", 1)[1])
            if case is None:
                raise OSError("404")
            return FakeResp(json.dumps(case))
        return FakeResp(b"")  # PUT


def row(i, kind="positive", company="PT Maju Jaya", paraphrased=False):
    if kind == "positive":
        return {"id": f"r{i}", "kind": kind, "set": "dev", "paraphrased": paraphrased, "source_url": "https://www.news.example/a", "source_title": None,
                "company_as_reported": company, "ad_text_as_reported": f"Lowongan di PT. Maju Jaya {i}"}
    return {"id": f"r{i}", "kind": kind, "set": "dev", "source_url": "https://licensed.example/a", "ad_text": f"Lowongan resmi {i}"}


def test_domain_and_small_helpers(mod, tmp_path):
    assert mod.domain("https://www.a.example/x") == "a.example" and mod.domain("https://a.example/x") == "a.example"
    assert mod.pct(1, 4) == "1/4 (25 %)" and mod.pct(0, 0) == "0/0"
    assert mod.company_matched({"lines": [LINE]}) is True
    assert mod.company_matched({"lines": [{**LINE, "guard": True}]}) is False
    assert mod.company_matched({}) is False
    assert mod.compact(None) == {"verdict": None}
    assert mod.compact(make_pack("c"))["never"] == ["tourist_visa"]


def test_post_check_variants(mod, monkeypatch):
    monkeypatch.setattr(mod.urllib.request, "urlopen", App(lambda b, n: make_pack("c1")))
    assert mod.post_check("http://app", "s", {"adText": "x"})[0] == "c1"
    monkeypatch.setattr(mod.urllib.request, "urlopen", App(lambda b, n: None))
    case_id, _, err = mod.post_check("http://app", "s", {})
    assert case_id is None and err == "no case id in the stream"
    monkeypatch.setattr(mod.urllib.request, "urlopen", App(lambda b, n: OSError("down")))
    case_id, _, err = mod.post_check("http://app", "s", {})
    assert case_id is None and err == "OSError: down"


def test_get_pack(mod, monkeypatch):
    app = App(lambda b, n: make_pack("c1"))
    monkeypatch.setattr(mod.urllib.request, "urlopen", app)
    mod.post_check("http://app", "s", {})
    assert mod.get_pack("http://app", "c1")["id"] == "c1"
    assert mod.get_pack("http://app", "missing") is None


def test_transient_failure(mod):
    assert mod.transient_failure(None) is True
    assert mod.transient_failure(make_pack("c", errors=["Tavily returned 503"])) is True
    assert mod.transient_failure(make_pack("c", errors=["", "all good"])) is False
    pack = make_pack("c")
    pack["receipt"]["tf"] = [{"error": "request timed out"}]
    assert mod.transient_failure(pack) is True
    assert mod.transient_failure(make_pack("c")) is False


def test_put_file(mod, tmp_path, monkeypatch, capsys):
    f = tmp_path / "r.jsonl"
    f.write_text("x")
    seen = []
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda req, timeout=None: seen.append(req.get_method()) or FakeResp())
    mod.put_file(f, None)
    assert seen == []
    mod.put_file(f, "https://put.example/x")
    assert seen == ["PUT"]
    mod.put_file(tmp_path / "missing", "https://put.example/x")
    assert "upload failed" in capsys.readouterr().err


def test_run_column_retries_transient_failures_but_never_the_rubric(mod, monkeypatch):
    bad = lambda b, n: make_pack(f"c{n}", errors=["Tavily returned 503"])  # noqa: E731
    app = App(bad)
    monkeypatch.setattr(mod.urllib.request, "urlopen", app)
    res = mod.run_column("http://app", "s", row(1), "full", end_date="2026-01-01")
    assert len(res["attempts"]) == 3 and app.bodies[0]["endDate"] == "2026-01-01" and app.bodies[0]["exclude"]["domain"] == "news.example"
    app = App(bad)
    monkeypatch.setattr(mod.urllib.request, "urlopen", app)
    assert len(mod.run_column("http://app", "s", row(2, "negative"), "rubric")["attempts"]) == 1
    assert "endDate" not in app.bodies[0] and app.bodies[0]["adText"] == "Lowongan resmi 2"
    app = App(lambda b, n: make_pack(f"c{n}") if n == 2 else None)
    monkeypatch.setattr(mod.urllib.request, "urlopen", app)
    res = mod.run_column("http://app", "s", row(3), "extract")
    assert [a["case_id"] for a in res["attempts"]] == [None, "c2"] and res["pack"]["id"] == "c2"


def test_bench_requires_the_secret(mod, monkeypatch, capsys):
    monkeypatch.delenv("AWAS_BENCH_SECRET", raising=False)
    assert mod.bench(type("A", (), {})()) == 2
    assert "AWAS_BENCH_SECRET is required" in capsys.readouterr().err


def args(tmp_path, rows, **kw):
    s = tmp_path / "set.jsonl"
    s.write_text("\n".join(json.dumps(r) for r in rows) + "\n\n")
    ns = {"set": str(s), "base": "http://app", "out": str(tmp_path / "res" / "r.jsonl"), "n": 0, "variance": 0, "summarise": None}
    ns.update(kw)
    (tmp_path / "res").mkdir(exist_ok=True)
    return type("Args", (), ns)()


def test_bench_runs_rows_skips_done_ones_uploads_and_runs_variance(mod, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("AWAS_BENCH_SECRET", "s")
    monkeypatch.setenv("AWAS_PUT_URL", "https://put.example/r")
    monkeypatch.setenv("AWAS_PUT_VARIANCE_URL", "https://put.example/v")
    counter = {"n": 0}

    def plan(body, n):
        counter["n"] += 1
        stage = body["stage"]
        v = "VERIFY_FIRST" if stage == "extract" else "STOP"
        return make_pack(f"c{n}", verdict=v, picker=(n % 2 == 0))

    app = App(plan)
    monkeypatch.setattr(mod.urllib.request, "urlopen", app)
    rows = [row(1), row(2, "negative"), row(3, paraphrased=True)]
    a = args(tmp_path, rows, n=2, variance=1)
    out = tmp_path / "res" / "r.jsonl"
    out.write_text(json.dumps(rec(1, "positive")) + "\n")  # r1 already done → skipped
    assert mod.bench(a) == 0
    recs = [json.loads(l) for l in out.read_text().splitlines()]
    assert [r["id"] for r in recs] == ["r1", "r2"]
    assert recs[1]["names_company"] is False and recs[1]["picker"]["verdict"] in ("STOP", None)
    var = (tmp_path / "res" / "r-variance.jsonl").read_text().splitlines()
    assert len(var) == 2 and json.loads(var[0])["rep"] == 2 and json.loads(var[0])["first"] == "STOP"
    assert (tmp_path / "res" / "r-summary.json").exists()


def test_bench_without_variance_stops_after_the_rows(mod, tmp_path, monkeypatch):
    monkeypatch.setenv("AWAS_BENCH_SECRET", "s")
    monkeypatch.delenv("AWAS_PUT_URL", raising=False)
    monkeypatch.setattr(mod.urllib.request, "urlopen", App(lambda b, n: make_pack(f"c{n}")))
    assert mod.bench(args(tmp_path, [row(1)])) == 0
    assert not (tmp_path / "res" / "r-variance.jsonl").exists()


def test_bench_with_a_row_the_app_never_answers(mod, tmp_path, monkeypatch):
    monkeypatch.setenv("AWAS_BENCH_SECRET", "s")
    monkeypatch.delenv("AWAS_PUT_URL", raising=False)
    monkeypatch.setattr(mod.urllib.request, "urlopen", App(lambda b, n: None))
    a = args(tmp_path, [row(1)], variance=1)
    assert mod.bench(a) == 0
    rec = json.loads((tmp_path / "res" / "r.jsonl").read_text())
    assert rec["full"]["company_matched"] is False and rec["picker"] == {"verdict": None, "company_matched": None}
    var = json.loads((tmp_path / "res" / "r-variance.jsonl").read_text().splitlines()[0])
    assert var["verdict"] is None and var["case_id"] is None


def write_results(tmp_path, recs, variance=None):
    p = tmp_path / "results.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in recs) + "\n\n")
    if variance:
        (tmp_path / "results-variance.jsonl").write_text("\n".join(json.dumps(v) for v in variance) + "\n")
    return p


def rec(i, kind, full="STOP", extract="VERIFY_FIRST", names=True, never=True, cm=True, paraphrased=False, pack="auto", retried=False):
    pk = make_pack(f"c{i}") if pack == "auto" else pack
    return {
        "id": f"r{i}", "kind": kind, "names_company": names, "paraphrased": paraphrased,
        "rubric": {"verdict": "STOP"}, "extract": {"verdict": extract, "attempts": [1, 2] if retried else [1]},
        "full": {"verdict": full, "never": ["x"] if never else [], "company_matched": cm, "attempts": [1]},
        "picker": {"verdict": full}, "full_pack": pk,
    }


def test_summarise_computes_the_tables(mod, tmp_path, capsys):
    broken_pack = make_pack("cb", lines=[{**LINE, "pageSha256": None}, {**LINE, "status": "dropped"}])
    p = write_results(tmp_path, [
        rec(1, "positive"), rec(2, "positive", full="VERIFY_FIRST", names=False, never=False, cm=False, paraphrased=True, retried=True),
        rec(3, "positive", never=True, cm=False), rec(4, "negative", full="NO_RED_FLAGS_FOUND"), rec(5, "negative", full=None, pack=None),
        rec(6, "positive", pack=broken_pack),
    ], variance=[{"verdict": "STOP", "first": "STOP"}, {"verdict": "VERIFY_FIRST", "first": "STOP"}])
    assert mod.summarise(p) == 1
    s = json.loads((tmp_path / "results-summary.json").read_text())
    assert s["rows"] == 6 and s["positives"] == 4 and s["negatives"] == 2
    assert s["cited_line_invariant"] == "BROKEN on 1 line(s)"
    assert s["variance"] == "1/2 reruns agree with the first run"
    assert s["retried_rows"] == 1 and s["seconds_full_p50"] == 2.0
    assert "CITED-LINE INVARIANT BROKEN" in capsys.readouterr().err


def test_summarise_a_clean_run_without_timings(mod, tmp_path):
    p = write_results(tmp_path, [rec(1, "positive", pack=None)])
    assert mod.summarise(p) == 0
    s = json.loads((tmp_path / "results-summary.json").read_text())
    assert s["seconds_full_p50"] is None and s["cited_line_invariant"] == "holds" and "variance" not in s


def test_main_dispatch(mod, monkeypatch, capsys):
    monkeypatch.setattr(mod, "summarise", lambda p: 7)
    monkeypatch.setattr(mod, "bench", lambda a: 8)
    monkeypatch.setattr(sys, "argv", ["bench", "--summarise", "x.jsonl"])
    assert mod.main() == 7
    monkeypatch.setattr(sys, "argv", ["bench", "--set", "s.jsonl", "--out", "o.jsonl"])
    assert mod.main() == 8
    monkeypatch.setattr(sys, "argv", ["bench"])
    assert mod.main() == 2
    assert "usage" in capsys.readouterr().out.lower()


def test_runs_as_a_script():
    assert run_as_main("bench") == 2
