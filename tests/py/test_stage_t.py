import json
import sys

import pytest

from conftest import FakeResp, run_as_main


@pytest.fixture
def mod(script):
    return script("stage_t")


def test_text_helpers(mod):
    assert mod.norm(None) == ""
    assert mod.norm("  PT. Maju  “Jaya”, ") == 'pt maju "jaya"'
    assert mod.tokens("Kerja di Kamboja") == {"kerja", "di", "kamboja"}
    assert mod.jaccard("a b", "b c") == pytest.approx(1 / 3)
    assert mod.jaccard("", "b") == 0.0


def test_correct_scalar(mod):
    assert mod.correct_scalar("company", None, "PT X") is False
    assert mod.correct_scalar("company", "PT X", None) is False
    assert mod.correct_scalar("company", "pt. x", "PT X") is True
    assert mod.correct_scalar("company", "PT Y", "PT X") is False
    assert mod.correct_scalar("job", "customer service online", "customer service") is True
    assert mod.correct_scalar("job", "driver", "customer service") is False


def test_match_list_pairs_each_item_once(mod):
    assert mod.match_list(["biaya admin 3 juta", "tiket"], ["biaya admin 3 juta", "biaya admin 3 juta lagi"]) == 1
    assert mod.match_list(["a b c"], ["x y z"]) == 0
    assert mod.match_list([], ["x"]) == 0
    assert mod.match_list(["biaya admin"], ["biaya admin", "biaya admin"]) == 1


def test_regex_company(mod):
    assert mod.regex_company("Lowongan PT. Maju Jaya Abadi, Jakarta") == "PT. Maju Jaya Abadi"
    assert mod.regex_company("Kerja di Star Wide Co., Ltd sekarang").startswith("Star Wide")
    assert mod.regex_company("tidak ada nama") is None


def check_with(mod, monkeypatch, sse, pack=None):
    def urlopen(req, timeout=None):
        if hasattr(req, "full_url"):
            return FakeResp(sse)
        return FakeResp(json.dumps(pack or {"extraction": None}))

    monkeypatch.setattr(mod.urllib.request, "urlopen", urlopen)
    return mod.check("http://app", "s", "ad text")


def test_check_resolves_the_case_id_from_started_or_done(mod, monkeypatch):
    started_only = 'event: started\ndata: {"caseId":"a"}\n\nevent: noise\ndata: {}'
    assert "pack" in check_with(mod, monkeypatch, started_only)
    both = 'event: started\ndata: {"caseId":"a"}\n\nevent: started\ndata: {"caseId":"b"}\n\nevent: done\ndata: {"caseId":"c"}\n\nevent: done\ndata: {"caseId":null}'
    assert "pack" in check_with(mod, monkeypatch, both)
    assert check_with(mod, monkeypatch, "event: noise\ndata: {}")["error"] == "no case id"


def row(i, labels):
    return {"id": f"p{i}", "text": f"Lowongan PT Maju Jaya {i}", "labels": {"id": f"p{i}", **labels}}


def test_score_counts_filled_and_empty_slots(mod):
    rows = [
        row(1, {"company": "PT Maju Jaya", "destination": "Kamboja", "job": None, "visa": "visa turis", "fees": ["biaya admin"], "promises": []}),
        row(2, {"company": None, "destination": None, "job": None, "visa": None, "fees": [], "promises": ["gaji besar"]}),
    ]
    preds = {
        "p1": {"company": "PT Maju Jaya", "destination": "Thailand", "job": "cs online", "visa": "visa turis", "fees": ["biaya admin"], "promises": []},
        "p2": {"company": "PT Palsu", "fees": ["x"], "promises": ["gaji besar"]},
    }
    s = mod.score(rows, preds)
    assert s["correct"] == 4 and s["labelled"] == 5
    assert s["false_fills"] >= 3 and s["company_false_fill_rate_pct"] == 100.0
    assert s["company_accuracy_pct"] == 100.0 and s["list_recall_pct"] == 100.0
    assert s["per_field"]["destination"] == {"correct": 0, "labelled": 1, "pct": 0.0}
    empty = mod.score([], {})
    assert empty["field_accuracy_pct"] is None and empty["list_precision_pct"] is None
    assert mod.score(rows[:1], {})["correct"] == 0


def write_inputs(tmp_path, n=2):
    dev = tmp_path / "dev.jsonl"
    labels = tmp_path / "labels.jsonl"
    dev.write_text("\n".join(json.dumps({"id": f"p{i}", "ad_text_as_reported": f"Lowongan PT Maju Jaya {i}"} if i != 2 else {"id": "p2", "ad_text": "Lowongan lain"}) for i in range(1, n + 1)) + "\n\n")
    labels.write_text("\n".join(json.dumps({"id": f"p{i}", "company": "PT Maju Jaya", "destination": None, "job": None, "visa": None, "fees": [], "promises": [], "labeller": "agent"}) for i in range(1, n + 1)) + "\n\n")
    return dev, labels


def run_main(mod, monkeypatch, tmp_path, secret="s", out=None):
    dev, labels = write_inputs(tmp_path)
    out = out or tmp_path / "out" / "t.json"
    monkeypatch.setattr(sys, "argv", ["x", "--model", "m/x", "--dev", str(dev), "--labels", str(labels), "--out", str(out), "--base", "http://app"])
    if secret:
        monkeypatch.setenv("AWAS_BENCH_SECRET", secret)
    else:
        monkeypatch.delenv("AWAS_BENCH_SECRET", raising=False)
    return mod.main(), out


def test_main_requires_the_secret(mod, monkeypatch, tmp_path, capsys):
    assert run_main(mod, monkeypatch, tmp_path, secret=None)[0] == 2
    assert "AWAS_BENCH_SECRET is required" in capsys.readouterr().err


def test_main_scores_each_row_and_accumulates_runs(mod, monkeypatch, tmp_path):
    answers = iter([
        {"pack": {"extraction": {"company": {"text": "PT Maju Jaya"}, "fees": [{"text": "x"}], "droppedFields": ["job"]},
                  "receipt": {"tf": [{"promptTokens": 5, "completionTokens": 2}]}}, "seconds": 1.5},
        {"error": "no case id", "seconds": 0.5},
    ])
    monkeypatch.setattr(mod, "check", lambda *a: next(answers))
    code, out = run_main(mod, monkeypatch, tmp_path)
    assert code == 0
    report = json.loads(out.read_text())
    assert report["labeller"] == "agent" and "m/x" in report["runs"]
    rows = report["runs"]["m/x"]["rows"]
    assert rows[0]["tokens"] == 7 and rows[0]["dropped_fields"] == ["job"] and rows[1]["error"] == "no case id"
    assert report["regex_baseline_company"]["company_labelled"] == 2
    # a second model is added to the same file
    answers2 = iter([{"pack": {"extraction": None, "receipt": {"tf": [{"error": "bad"}]}}, "seconds": 2.0}] * 2)
    monkeypatch.setattr(mod, "check", lambda *a: next(answers2))
    monkeypatch.setattr(sys, "argv", ["x", "--model", "m/y", "--dev", str(tmp_path / "dev.jsonl"), "--labels", str(tmp_path / "labels.jsonl"), "--out", str(out)])
    assert mod.main() == 0
    again = json.loads(out.read_text())
    assert set(again["runs"]) == {"m/x", "m/y"}
    assert again["runs"]["m/y"]["rows"][0]["error"] == "bad"


def test_runs_as_a_script():
    assert run_as_main("stage_t", "--help") == 0
