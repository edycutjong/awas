import hashlib
import json
import sys
import urllib.error

import pytest

from conftest import FakeResp, run_as_main


@pytest.fixture
def mod(script, tmp_path, monkeypatch):
    m = script("seed")
    monkeypatch.setattr(m, "BENCH", tmp_path / "bench")
    (tmp_path / "bench").mkdir()
    monkeypatch.setattr(m.time, "sleep", lambda s: None)
    return m


def pos(mod, i, set_="dev", url=None, company="PT Maju Jaya", text=None, **over):
    r = {
        "id": f"{set_}-p{i}", "set": set_, "kind": "positive", "source_url": url or f"https://news.example/{set_}/{i}", "source_title": "t",
        "published": "2026-01-01", "ad_text_as_reported": text or f"Lowongan {company} nomor {i}", "paraphrased": i % 2 == 0, "redactions": [],
        "company_as_reported": company,
    }
    r.update(over)
    r["sha256"] = hashlib.sha256(mod.canonical(r).encode()).hexdigest()
    return r


def neg(mod, i, set_="dev", company="CV Sinar", **over):
    r = {"id": f"{set_}-n{i}", "set": set_, "kind": "negative", "source_url": f"https://licensed.example/{set_}/{i}", "ad_text": f"Lowongan resmi {company}", "company": company}
    r.update(over)
    r["sha256"] = hashlib.sha256(mod.canonical(r).encode()).hexdigest()
    return r


def write(mod, name, rows):
    (mod.BENCH / f"{name}.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n\n")


def manifest(mod, sets, tamper=None):
    m = {"sets": {}}
    for name, rows in sets.items():
        body = (mod.BENCH / f"{name}.jsonl").read_text()
        m["sets"][name] = {"file_sha256": hashlib.sha256(body.encode()).hexdigest(), "rows": {r["id"]: r["sha256"] for r in rows}}
    if tamper:
        tamper(m)
    (mod.BENCH / "MANIFEST.json").write_text(json.dumps(m))


def test_helpers(mod, tmp_path):
    assert mod.load(tmp_path / "missing.jsonl") == []
    assert mod.norm_company(None) == "" and mod.norm_company("PT.  Maju") == "pt maju"
    assert mod.canonical({"id": "a", "b": 1, "sha256": "x"}) == '{"b":1}'


def test_check_ok_with_no_files(mod, capsys):
    assert mod.check(False) == 0
    assert "seed --check: OK" in capsys.readouterr().out


def test_check_passes_on_a_consistent_bench(mod, capsys, monkeypatch):
    dev = [pos(mod, 1), pos(mod, 2, company="PT Lain"), pos(mod, 3, company=None, text="tanpa nama"), neg(mod, 1)]
    t1 = [pos(mod, 1, "tranche1", company="PT Tiga")]
    write(mod, "dev", dev)
    write(mod, "tranche1", t1)
    manifest(mod, {"dev": dev, "tranche1": t1})
    (mod.BENCH / "samples.json").write_text(json.dumps({"samples": [{"slug": "s", "source_url": "https://other.example/x", "company": "PT Unik"}, {"slug": "t"}]}))
    monkeypatch.setattr(mod, "head", lambda u: 200)
    assert mod.check(True) == 0
    out = capsys.readouterr().out
    assert '"x_positives_naming_company": 2' in out and "OK" in out


def test_check_reports_each_problem(mod, capsys, monkeypatch):
    bad_fields = pos(mod, 1)
    del bad_fields["published"]
    phone = pos(mod, 2, text="Hubungi 0812-3456-7890 sekarang", company=None)
    changed = pos(mod, 3)
    changed["ad_text_as_reported"] = "diubah"
    dup_url = pos(mod, 4, url="https://news.example/shared")
    dev = [bad_fields, phone, changed, dup_url, pos(mod, 5, company="PT Bersama"), pos(mod, 6, company="PT Bersama")]
    t1 = [pos(mod, 7, "tranche1", url="https://news.example/shared", company="PT Bersama"), pos(mod, 8, "tranche1", company="PT Tiga")]
    write(mod, "dev", dev)
    write(mod, "tranche1", t1)

    def tamper(m):
        m["sets"]["dev"]["rows"].pop(dev[0]["id"], None)
        m["sets"]["tranche1"]["file_sha256"] = "0" * 64

    manifest(mod, {"dev": dev, "tranche1": t1}, tamper)
    (mod.BENCH / "samples.json").write_text(json.dumps({"samples": [{"slug": "s1", "source_url": "https://news.example/shared"}, {"slug": "s2", "company": "PT Tiga"}]}))
    monkeypatch.setattr(mod, "head", lambda u: 404)
    assert mod.check(True) == 1
    out = capsys.readouterr().out
    for needle in ("missing ['published']", "phone-number digits", "row changed since it was hashed", "not in MANIFEST.json", "appears in dev and tranche1",
                   "company 'pt bersama' appears in dev and tranche1", "file hash differs", "sample s1: source", "sample s2: company", "answered 404"):
        assert needle in out, needle


def test_check_accepts_a_manifest_without_file_hash_or_a_missing_set(mod, capsys):
    dev = [pos(mod, 1)]
    write(mod, "dev", dev)
    manifest(mod, {"dev": dev}, lambda m: m["sets"]["dev"].pop("file_sha256"))
    assert mod.check(False) == 0


def test_head_falls_back_from_head_to_get(mod, monkeypatch):
    methods = []

    def make(sequence):
        def urlopen(req, timeout=None):
            methods.append(req.get_method())
            step = sequence.pop(0)
            if isinstance(step, Exception):
                raise step
            return step

        return urlopen

    ok = FakeResp(status=200)
    http = lambda code: urllib.error.HTTPError("u", code, "m", {}, None)  # noqa: E731
    monkeypatch.setattr(mod.urllib.request, "urlopen", make([ok]))
    assert mod.head("https://x.example") == 200
    monkeypatch.setattr(mod.urllib.request, "urlopen", make([http(405), ok]))
    assert mod.head("https://x.example") == 200
    monkeypatch.setattr(mod.urllib.request, "urlopen", make([http(405), http(404)]))
    assert mod.head("https://x.example") == 404
    monkeypatch.setattr(mod.urllib.request, "urlopen", make([OSError("x"), ok]))
    assert mod.head("https://x.example") == 200
    monkeypatch.setattr(mod.urllib.request, "urlopen", make([OSError("x"), OSError("y")]))
    assert mod.head("https://x.example") == 0
    assert methods[:2] == ["HEAD", "HEAD"]


def test_head_gives_up_when_a_response_swallows_its_own_error(mod, monkeypatch):
    """A response whose context manager suppresses the error raised while reading `status`: the loop ends without a return."""

    class Swallowing:
        def __enter__(self):
            return self

        @property
        def status(self):
            raise RuntimeError("unreadable")

        def __exit__(self, *a):
            return True

    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda *a, **k: Swallowing())
    assert mod.head("https://x.example") == 0


def samples_file(mod):
    (mod.BENCH / "samples.json").write_text(json.dumps({"samples": [
        {"slug": "a", "ad_text": "iklan a", "label": "A"},
        {"slug": "b", "ad_text": "iklan b", "label": "B", "lang": "en"},
        {"slug": "c", "ad_text": "iklan c", "label": "C"},
    ]}))


def test_record_samples_needs_both_secrets(mod, monkeypatch, capsys):
    monkeypatch.delenv("AWAS_BENCH_SECRET", raising=False)
    monkeypatch.setenv("AWAS_JUDGE_CODE", "j")
    assert mod.record_samples("http://app") == 2
    assert "are required" in capsys.readouterr().err


def test_record_samples_runs_each_sample_and_tolerates_fragment_failures(mod, monkeypatch, capsys):
    samples_file(mod)
    monkeypatch.setenv("AWAS_BENCH_SECRET", "s")
    monkeypatch.setenv("AWAS_JUDGE_CODE", "j c")
    posted = []

    def urlopen(req, timeout=None):
        body = json.loads(req.data)
        if "/api/check" in req.full_url:
            assert "judge=j%20c" in req.full_url
            if body["adText"] == "iklan c":
                return FakeResp("event: noise\ndata: {}\n\n")
            return FakeResp('event: done\ndata: {"caseId": "case-' + body["adText"][-1] + '"}\n\n')
        posted.append(body)
        return FakeResp(json.dumps({"stored": "samples/x", "fragmentsFound": 2}))

    class Done:
        def __init__(self, out, err=""):
            self.stdout, self.stderr = out, err

    runs = iter([Done('{"1": true}', "log\n"), Done("")])

    def run(cmd, **kw):
        step = next(runs, None)
        if step is None:
            raise OSError("no node")
        return step

    monkeypatch.setattr(mod.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(mod.subprocess, "run", run)
    assert mod.record_samples("http://app") == 0
    assert [p["slug"] for p in posted] == ["a", "b"]
    assert posted[0]["fragments"] == {"1": True} and posted[1]["fragments"] == {}
    err = capsys.readouterr().err
    assert "c: no case id" in err and "a: case case-a" in err


def test_record_samples_survives_a_failing_fragment_check(mod, monkeypatch, capsys):
    (mod.BENCH / "samples.json").write_text(json.dumps({"samples": [{"slug": "a", "ad_text": "iklan a", "label": "A"}]}))
    monkeypatch.setenv("AWAS_BENCH_SECRET", "s")
    monkeypatch.setenv("AWAS_JUDGE_CODE", "j")

    def urlopen(req, timeout=None):
        if "/api/check" in req.full_url:
            return FakeResp('event: done\ndata: {"caseId": "k"}\n\n')
        return FakeResp(json.dumps({"stored": "s", "fragmentsFound": 0}))

    monkeypatch.setattr(mod.urllib.request, "urlopen", urlopen)

    def boom(*a, **k):
        raise OSError("no node")

    monkeypatch.setattr(mod.subprocess, "run", boom)
    assert mod.record_samples("http://app") == 0
    assert "fragment check failed: no node" in capsys.readouterr().err


def test_main_dispatch(mod, monkeypatch, capsys):
    monkeypatch.setattr(mod, "check", lambda net: 10 + int(net))
    monkeypatch.setattr(mod, "record_samples", lambda base: 20)
    monkeypatch.setattr(sys, "argv", ["seed", "--check"])
    assert mod.main() == 11
    monkeypatch.setattr(sys, "argv", ["seed", "--check", "--no-net"])
    assert mod.main() == 10
    monkeypatch.setattr(sys, "argv", ["seed", "--samples", "--base", "http://x"])
    assert mod.main() == 20
    monkeypatch.setattr(sys, "argv", ["seed"])
    assert mod.main() == 2
    assert "usage" in capsys.readouterr().out.lower()


def test_runs_as_a_script():
    assert run_as_main("seed") == 2
