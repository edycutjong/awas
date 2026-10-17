import sys

import pytest

from conftest import run_as_main

GOOD_README = (
    "# Awas\n[live](https://awas-cek.vercel.app) [repo](https://github.com/edycutjong/awas)\n"
    "Video https://youtu.be/abcdefgh12\nWe ran 164 tests (see DEMO) in 2026 at 50%.\n"
)


@pytest.fixture
def mod(script, tmp_path, monkeypatch):
    m = script("check_submission_readiness")
    monkeypatch.setattr(m, "ROOT", tmp_path)
    (tmp_path / "docs").mkdir()
    (tmp_path / "bench").mkdir()
    (tmp_path / "docs" / "proof").mkdir()
    return m


def run(m, monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["x", *args])
    return m.main()


def test_lines_and_corpus_tolerate_missing_files(mod, tmp_path):
    assert mod.lines(tmp_path / "nope.md") == []
    assert mod.corpus() == ""
    (tmp_path / "DEMO.md").write_text("alpha 164", encoding="utf-8")
    (tmp_path / "docs" / "SOURCES.md").write_text("src 50%", encoding="utf-8")
    (tmp_path / "bench" / "x-summary.json").write_text("{}", encoding="utf-8")
    (tmp_path / "docs" / "proof" / "p.json").write_text("{}", encoding="utf-8")
    assert "alpha 164" in mod.corpus() and "src 50%" in mod.corpus()


def test_norm_figure_variants(mod):
    assert set(mod.norm_figure("1.234")) >= {"1.234", "1,234", "1234"}
    assert "50" in mod.norm_figure("50 %")


def test_passes_when_everything_is_present(mod, tmp_path, monkeypatch, capsys):
    (tmp_path / "README.md").write_text(GOOD_README, encoding="utf-8")
    (tmp_path / "DEMO.md").write_text("164 tests, 50% ok", encoding="utf-8")
    assert run(mod, monkeypatch) == 0
    assert "OK" in capsys.readouterr().out


def test_reports_every_kind_of_problem(mod, tmp_path, monkeypatch, capsys):
    bad = "Hello {placeholder} and `{in_code}` my family got an ad. 9999 users and 77%. Year 2026. [x](http://a/1234)\n"
    (tmp_path / "README.md").write_text(bad, encoding="utf-8")
    extra = tmp_path / "draft.md"
    extra.write_text("keluarga saya {x_y}\n", encoding="utf-8")
    assert run(mod, monkeypatch, "--text", str(extra)) == 1
    out = capsys.readouterr().out
    assert "unfilled placeholder" in out
    assert "first-person family sentence" in out
    assert "missing live URL" in out and "missing video URL" in out
    assert "figure '9999'" in out and "figure '77%'" in out
    assert "draft.md" in out
    assert "problem(s)" in out


def test_family_confirmed_flag_skips_the_family_check(mod, tmp_path, monkeypatch, capsys):
    (tmp_path / "README.md").write_text(GOOD_README + "my family saw it\n", encoding="utf-8")
    (tmp_path / "DEMO.md").write_text("164 50%", encoding="utf-8")
    assert run(mod, monkeypatch, "--family-confirmed") == 0
    assert "first-person" not in capsys.readouterr().out


def test_runs_as_a_script():
    assert run_as_main("check_submission_readiness", "--help") == 0
