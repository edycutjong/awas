import json
import sys

import pytest

from conftest import FakeResp, run_as_main


def row(i, kind="positive", company="PT Maju Jaya", ad=None):
    return {
        "id": f"p{i}", "kind": kind, "ad_text_as_reported": ad or f"Lowongan di PT Maju Jaya nomor {i}",
        "source_url": "https://www.news.example/a", "source_title": None if i % 2 else "Judul", "company_as_reported": company,
        "published": "2026-03-10T00:00:00Z",
    }


MATCHED = {"status": "verified", "purpose": "company", "entity": True, "entityCapped": False, "entityKind": "company", "negative": True, "guard": False,
           "url": "https://a.example/1", "quote": "q", "reason": None}


def pack_for(case_id, verdict="STOP"):
    return {
        "id": case_id, "verdict": verdict, "rule": "r", "flags": [{"id": "tourist_visa", "class": "NEVER", "span": {"text": "visa turis"}}],
        "tavily": [
            {"method": "search", "purpose": "company", "params": {"query": "q"}, "credits": 1, "urls": ["https://a.example/1", "https://b.example/2"], "titles": ["A", "B"]},
            {"method": "extract", "purpose": "advisory", "params": {}, "credits": 0, "urls": ["https://c.example/3"]},
            {"method": "search", "purpose": "pattern", "params": None, "credits": None, "urls": [], "error": "e"},
        ],
        "lines": [MATCHED, {**MATCHED, "status": "dropped", "reason": "not_in_page"}],
        "receipt": {"failedSteps": [], "tavilyCredits": 2},
    }


@pytest.fixture
def mod(script):
    return script("stage_rv")


def install(mod, monkeypatch, verdicts=None, no_done=()):
    """A fake app: POST /api/check streams an SSE `done` event; GET /api/case/<id> serves the pack."""
    calls = []
    counter = {"n": 0}

    def urlopen(req, timeout=None):
        if hasattr(req, "full_url") and req.full_url.endswith("/api/check"):
            body = json.loads(req.data)
            calls.append(body)
            counter["n"] += 1
            if counter["n"] in no_done:
                return FakeResp("event: started\ndata: {}\n\nevent: noise\ndata: {}\n\n")
            done = json.dumps({"caseId": "c" + str(counter["n"])})
            return FakeResp("event: started\ndata: {}\n\nevent: done\ndata: " + done + "\n\n")
        url = req if isinstance(req, str) else req.full_url
        n = int(url.rsplit("c", 1)[1])
        v = (verdicts or {}).get(n, "STOP")
        return FakeResp(json.dumps(pack_for(f"c{n}", v)))

    monkeypatch.setattr(mod.urllib.request, "urlopen", urlopen)
    return calls


def write_dev(tmp_path, rows):
    p = tmp_path / "dev.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in rows) + "\n\n")
    return p


def run_main(mod, monkeypatch, tmp_path, stage, rows, secret="s3cret"):
    dev = write_dev(tmp_path, rows)
    out = tmp_path / "out" / "r.json"
    monkeypatch.setattr(sys, "argv", ["x", stage, "--dev", str(dev), "--out", str(out), "--base", "http://app"])
    if secret:
        monkeypatch.setenv("AWAS_BENCH_SECRET", secret)
    else:
        monkeypatch.delenv("AWAS_BENCH_SECRET", raising=False)
    code = mod.main()
    return code, (json.loads(out.read_text()) if out.exists() else None)


def test_helpers(mod):
    assert mod.domain("https://www.news.example/a") == "news.example"
    assert mod.domain("https://news.example/a") == "news.example"
    assert mod.company_matched(MATCHED) is True
    assert mod.company_matched({**MATCHED, "guard": True}) is False
    assert mod.names_company(row(1)) is True
    assert mod.names_company(row(1, company="PT. Lain")) is False
    assert mod.names_company(row(1, company="")) is False
    assert mod.names_company(row(1, company=None)) is False
    assert mod.names_company({**row(1, company="PT. Maju Jaya"), "ad_text_as_reported": "kerja di pt. maju jaya"}) is True


def test_run_posts_the_bench_request_and_fetches_the_pack(mod, monkeypatch):
    calls = install(mod, monkeypatch)
    pack, secs = mod.run("http://app", "s", row(1), "full", end_date="2026-03-09")
    assert pack["id"] == "c1" and secs >= 0
    assert calls[0]["endDate"] == "2026-03-09" and calls[0]["exclude"] == {"domain": "news.example", "title": ""}
    mod.run("http://app", "s", row(2), "rubric")
    assert "endDate" not in calls[1] and calls[1]["exclude"]["title"] == "Judul"


def test_run_returns_none_without_a_done_event(mod, monkeypatch):
    install(mod, monkeypatch, no_done={1})
    pack, _ = mod.run("http://app", "s", row(1), "full")
    assert pack is None


def test_requires_the_bench_secret(mod, monkeypatch, tmp_path, capsys):
    assert run_main(mod, monkeypatch, tmp_path, "r", [row(1)], secret=None)[0] == 2
    assert "AWAS_BENCH_SECRET is required" in capsys.readouterr().err


def test_stage_r_picks_the_frame_from_the_stop_count(mod, monkeypatch, tmp_path):
    install(mod, monkeypatch, no_done={2})
    rows = [row(i) for i in range(1, 4)] + [row(9, kind="negative")]
    code, report = run_main(mod, monkeypatch, tmp_path, "r", rows)
    assert code == 0
    assert report["summary"]["positives"] == 3 and report["summary"]["stop_on_rules_alone"] == 2
    assert report["summary"]["frame"] == "lead with evidence-flipped STOPs"
    assert report["rows"][1]["verdict"] is None and report["rows"][1]["flags"] == []


def test_stage_r_reports_the_rule_frame_at_fifteen_stops(mod, monkeypatch, tmp_path):
    install(mod, monkeypatch)
    _, report = run_main(mod, monkeypatch, tmp_path, "r", [row(i) for i in range(1, 16)])
    assert report["summary"]["frame"] == "the rule stops it; the evidence convinces the nephew"


def test_stage_v_records_searches_lines_and_totals(mod, monkeypatch, tmp_path):
    install(mod, monkeypatch, no_done={2})
    code, report = run_main(mod, monkeypatch, tmp_path, "v", [row(1), row(2)])
    assert code == 0
    first, second = report["rows"]
    assert first["verified_lines"] == 1 and first["company_matched_lines"] == 1 and first["credits"] == 2
    assert first["tavily"][0]["results"][1]["title"] == "B" and first["tavily"][1]["results"][0]["title"] is None
    assert second["tavily"] == [] and second["verdict"] is None and second["credits"] is None
    assert report["summary"]["cases_with_any_result"] == 1 and report["summary"]["credits"] == 2


def test_stage_vtime_scores_only_rows_naming_a_company(mod, monkeypatch, tmp_path):
    install(mod, monkeypatch, no_done={3})
    few = [row(1), row(2), row(3), row(4, company="")]
    _, report = run_main(mod, monkeypatch, tmp_path, "vtime", few)
    assert report["summary"]["naming_a_company"] == 3
    assert report["summary"]["result"].startswith("inconclusive")
    assert report["rows"][0]["end_date"] == "2026-03-09"
    assert report["rows"][2]["company_matched_lines"] == 0


def test_stage_vtime_pass_and_fail(mod, monkeypatch, tmp_path):
    install(mod, monkeypatch)
    _, report = run_main(mod, monkeypatch, tmp_path, "vtime", [row(i) for i in range(1, 9)])
    assert report["summary"]["result"] == "pass"
    # every pack is served with no company-matched line → fail
    monkeypatch.setattr(mod, "company_matched", lambda line: False)
    _, report = run_main(mod, monkeypatch, tmp_path, "vtime", [row(i) for i in range(1, 9)])
    assert report["summary"]["result"] == "fail"


def test_runs_as_a_script():
    assert run_as_main("stage_rv", "--help") == 0
