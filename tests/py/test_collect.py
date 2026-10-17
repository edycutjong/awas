import json
import re
import sys
import urllib.error

import pytest

from conftest import FakeResp, run_as_main


@pytest.fixture
def mod(script, monkeypatch):
    m = script("collect")
    monkeypatch.setattr(m.time, "sleep", lambda s: None)
    return m


def fake_fetch(pages):
    """Replace collect.fetch: `pages` maps url -> (status, html); anything else is a 404."""
    seen = []

    def fetch(url, timeout=30, headers=None):
        seen.append(url)
        status, raw = pages.get(url, (404, ""))
        return status, url, raw

    fetch.seen = seen
    return fetch


def test_fetch_success_http_error_and_network_error(mod, monkeypatch):
    monkeypatch.setattr(mod.urllib.request, "urlopen", lambda req, timeout=None: FakeResp("héllo", 200, url="https://final.example/x"))
    assert mod.fetch("https://x.example", headers={"X-Test": "1"}) == (200, "https://final.example/x", "héllo")

    def http_error(req, timeout=None):
        raise urllib.error.HTTPError("u", 503, "m", {}, None)

    monkeypatch.setattr(mod.urllib.request, "urlopen", http_error)
    assert mod.fetch("https://x.example") == (503, "https://x.example", "")

    def boom(req, timeout=None):
        raise OSError("down")

    monkeypatch.setattr(mod.urllib.request, "urlopen", boom)
    assert mod.fetch("https://x.example") == (0, "https://x.example", "ERROR OSError: down")


def test_small_helpers(mod):
    assert mod.domain("https://www.antaranews.com/tag/x") == "antaranews.com"
    assert len(mod.cache_key("u")) == 16
    assert mod.norm("“A”  ‘b’ – c\n d") == "\"A\" 'b' - c d"


LD_ARTICLE = {"@type": "NewsArticle", "headline": "Judul Berita", "datePublished": "2026-03-04T10:00:00+07:00"}


def html_with(ld=(), extra="", paragraphs=()):
    scripts = "".join(f'<script type="application/ld+json">{b}</script>' for b in ld)
    paras = "".join(f"<p>{p}</p>" for p in paragraphs)
    return f"<html><head>{scripts}{extra}</head><body><!-- c --><style>x</style><script>y</script>{paras}</body></html>"


LONG1 = "Polisi mengungkap kasus perdagangan orang ke Kamboja dengan modus lowongan kerja."
LONG2 = "Korban dijanjikan gaji besar sebagai admin online oleh perekrut tidak resmi di media sosial."


def test_page_text_reads_json_ld_meta_and_paragraphs(mod):
    raw = html_with(
        ld=["{not json", json.dumps([LD_ARTICLE]), json.dumps({"@graph": [{"@type": "WebPage"}, "str", {"@type": "Article", "headline": "Lain", "datePublished": "2027"}]}),
            json.dumps({"@type": "Article"}), json.dumps("just a string")],
        paragraphs=["pendek", "Baca juga: berita lain yang sangat panjang sekali sekali sekali", LONG1, LONG2],
    )
    text, title, published = mod.page_text(raw)
    assert title == "Judul Berita" and published.startswith("2026-03-04")
    assert text.split("\n") == [LONG1, LONG2]


def test_page_text_falls_back_to_meta_tags_or_none(mod):
    raw = html_with(
        ld=[json.dumps({"@graph": [{"@type": "ReportageNewsArticle"}]}), json.dumps({"@type": "NewsArticle", "headline": "H"})],
        extra='<meta property="article:published_time" content="2026-01-02"><meta property="og:title" content="OG &amp; Title">',
    )
    assert mod.page_text(raw) == ("", "H", "2026-01-02")
    assert mod.page_text(html_with(extra='<meta property="og:title" content="OG &amp; Title">'))[1:] == ("OG & Title", None)
    assert mod.page_text("<html></html>") == ("", None, None)


LISTING_HTML = (
    '<a href="https://www.antaranews.com/berita/1/satu">a</a><a href="https://www.antaranews.com/berita/1/satu">dup</a>'
    '<a href="https://www.antaranews.com/berita/2/dua">b</a>'
)


def tiny_listings(monkeypatch, mod):
    monkeypatch.setattr(mod, "LISTINGS", [("antara-x", "https://www.antaranews.com/tag/x", lambda b, p: b if p == 1 else f"{b}/{p}", 2)])


def test_cmd_listings_collects_links_in_page_order(mod, tmp_path, monkeypatch, capsys):
    tiny_listings(monkeypatch, mod)
    monkeypatch.setattr(mod, "fetch", fake_fetch({
        "https://www.antaranews.com/tag/x": (200, LISTING_HTML),
        "https://www.antaranews.com/tag/x/2": (200, '<a href="https://www.antaranews.com/berita/2/dua">b</a><a href="https://www.antaranews.com/berita/3/tiga">c</a>'),
    }))
    mod.cmd_listings(tmp_path)
    rows = json.loads((tmp_path / "listings.json").read_text())
    assert [r["url"].rsplit("/", 1)[1] for r in rows] == ["satu", "dua", "tiga"]
    assert [r["listing_position"] for r in rows] == [1, 2, 3]
    assert "3 article URLs" in capsys.readouterr().out


def test_cmd_listings_a1_and_a2_append_without_moving_earlier_rows(mod, tmp_path, monkeypatch):
    existing = [{"listing": "antara-x", "listing_page": 1, "listing_position": 1, "url": "https://www.antaranews.com/berita/1/satu"}]
    (tmp_path / "listings.json").write_text(json.dumps(existing))
    monkeypatch.setattr(mod, "AMENDMENT_1", [("a1", "https://www.antaranews.com/tag/y", lambda b, p: f"{b}/{p}", 1, 2)])
    monkeypatch.setattr(mod, "fetch", fake_fetch({
        "https://www.antaranews.com/tag/y/1": (200, LISTING_HTML),
        "https://www.antaranews.com/tag/y/2": (200, ""),
    }))
    mod.cmd_listings_a1(tmp_path)
    rows = json.loads((tmp_path / "listings.json").read_text())
    assert [r.get("amendment") for r in rows] == [None, 1] and rows[1]["listing_position"] == 2
    monkeypatch.setattr(mod, "AMENDMENT_2", [
        ("rri", "https://www.rri.co.id/tag/tppo", lambda b, p: b, 1, 1),
        ("jpnn", "https://www.jpnn.com/tag/tppo", lambda b, p: f"{b}?page={p}", 1, 1),
    ])
    monkeypatch.setattr(mod, "fetch", fake_fetch({
        "https://www.rri.co.id/tag/tppo": (200, '<a href="https://www.rri.co.id/nasional/berita/123456/satu-dua">r</a>'),
        "https://www.jpnn.com/tag/tppo?page=1": (200, '<a href="https://www.jpnn.com/news/kasus-lama">l</a><a href="https://www.jpnn.com/news/kasus-baru">j</a><a href="https://www.jpnn.com/news/kasus-baru">j</a>'),
    }))
    rows.append({"listing": "old", "listing_page": 1, "listing_position": 3, "url": "https://www.jpnn.com/news/kasus-lama"})
    (tmp_path / "listings.json").write_text(json.dumps(rows))
    mod.cmd_listings_a2(tmp_path)
    rows = json.loads((tmp_path / "listings.json").read_text())
    assert [r.get("amendment") for r in rows] == [None, 1, None, 2, 2]


def test_cmd_fetch_skips_cached_and_withdrawn_pages(mod, tmp_path, monkeypatch):
    rows = [
        {"url": "https://www.antaranews.com/berita/1/x"},  # withdrawn outlet
        {"url": "https://www.jpnn.com/news/cached"},
        {"url": "https://www.jpnn.com/news/ok"},
        {"url": "https://www.jpnn.com/news/missing"},
    ]
    (tmp_path / "listings.json").write_text(json.dumps(rows))
    (tmp_path / "pages").mkdir()
    (tmp_path / "pages" / f"{mod.cache_key(rows[1]['url'])}.json").write_text("{}")
    fetch = fake_fetch({rows[2]["url"]: (200, html_with(ld=[json.dumps(LD_ARTICLE)], paragraphs=[LONG1]))})
    monkeypatch.setattr(mod, "fetch", fetch)
    mod.cmd_fetch(tmp_path)
    assert fetch.seen == [rows[2]["url"], rows[3]["url"]]
    ok = json.loads((tmp_path / "pages" / f"{mod.cache_key(rows[2]['url'])}.json").read_text())
    missing = json.loads((tmp_path / "pages" / f"{mod.cache_key(rows[3]['url'])}.json").read_text())
    assert ok["http"] == 200 and ok["title"] == "Judul Berita" and missing["http"] == 404 and missing["text"] == ""


def put_pages(mod, tmp_path, specs):
    """specs: list of (listing row extras, page dict)."""
    rows = []
    (tmp_path / "pages").mkdir(exist_ok=True)
    for i, (extra, page) in enumerate(specs):
        row = {"listing": "l", "listing_page": 1, "listing_position": i + 1, "url": f"https://www.jpnn.com/news/{i}", **extra}
        rows.append(row)
        (tmp_path / "pages" / f"{mod.cache_key(row['url'])}.json").write_text(json.dumps({"url": row["url"], "title": f"T{i}", **page}))
    (tmp_path / "listings.json").write_text(json.dumps(rows))


ON = "Kasus tppo perdagangan orang ke Kamboja terungkap. Korban ditawari lowongan kerja di luar negeri."


def test_cmd_prefilter_sorts_rows_into_candidates_and_reasons(mod, tmp_path, capsys):
    put_pages(mod, tmp_path, [
        ({}, {"http": 500, "text": "", "published": "2026-01-01"}),
        ({}, {"http": 200, "text": ON, "published": None}),
        ({}, {"http": 200, "text": ON, "published": "2019-01-01T00:00:00"}),
        ({}, {"http": 200, "text": "Berita olahraga hari ini yang tidak terkait sama sekali.", "published": "2026-01-01"}),
        ({}, {"http": 200, "text": ON, "published": "2026-01-01T00:00:00"}),
        ({"url": "https://www.antaranews.com/berita/1/withdrawn"}, {"http": 200, "text": ON, "published": "2026-01-01"}),
    ])
    mod.cmd_prefilter(tmp_path)
    cands = json.loads((tmp_path / "candidates.json").read_text())
    assert len(cands) == 1 and cands[0]["published"] == "2026-01-01"
    reasons = [json.loads(l)["reason"] for l in (tmp_path / "rejects-prefilter.jsonl").read_text().splitlines()]
    assert reasons == ["unfetchable", "out_of_range", "out_of_range", "off_topic"]
    assert "1 candidates, 4 rejected" in capsys.readouterr().out


def test_cmd_prefilter_amendment_requires_an_offer_word(mod, tmp_path):
    no_offer = "Kasus tppo perdagangan orang ke Kamboja terungkap oleh polisi setempat pekan ini."
    put_pages(mod, tmp_path, [
        ({"amendment": 1}, {"http": 200, "text": no_offer, "published": "2026-01-01"}),
        ({"amendment": 1}, {"http": 200, "text": ON, "published": "2026-01-01"}),
        ({}, {"http": 200, "text": ON, "published": "2026-01-01"}),
    ])
    mod.cmd_prefilter(tmp_path, amendment=1)
    assert len(json.loads((tmp_path / "candidates-a1.json").read_text())) == 1
    assert json.loads((tmp_path / "rejects-prefilter-a1.jsonl").read_text())["reason"] == "no_offer_detail"


BOARD = (
    '<div class="content-main-right single-detail"> <h3> Operator Pabrik </h3></div>'
    '<span class="company">PT Resmi</span> <span class="location">Bekasi</span>'
    "<!-- hidden --><select><option>x</option></select>"
    "<ul><li>Deskripsi Pekerjaan</li><li>Mengoperasikan mesin.</li><li>No SIP</li><li>SIP-123</li><li>Pekerjaan Lainnya</li><li>Lain</li></ul>"
)


def test_board_text_extracts_the_displayed_vacancy(mod):
    text, meta = mod.board_text(BOARD, {"AGENCY": "Agen", "NEGARA": "Taiwan", "JOB_GAJI": "1000", "JOB_GAJI_TYPE": "USD"})
    assert text.split("\n")[:5] == ["Operator Pabrik", "PT Resmi", "Bekasi", "Agen Taiwan", "1000 USD"]
    assert "Mengoperasikan mesin." in text and "Lain" not in text
    assert meta == {"position": "Operator Pabrik", "sip_no": "SIP-123"}
    bare = "<ul><li>Deskripsi Pekerjaan</li><li>Tugas</li></ul>"
    text, meta = mod.board_text(bare, {})
    assert text == "Deskripsi Pekerjaan\nTugas" and meta == {"position": "", "sip_no": None}
    assert mod.board_text("<p>nothing</p>", {}) == ("", {})


def board_page(records):
    return json.dumps({"result": records})


def rec(i, **kw):
    r = {"JS_ID": i, "P3MI": f"CO {i}", "NEGARA": "Taiwan", "SUSAHA": "x", "JABATAN": "Operator", "SEKTOR_ID": "001.006.001", "SIP_NO": f"S{i}", "AGENCY": "A"}
    r.update(kw)
    return r


def test_cmd_negatives_applies_the_rejection_rules(mod, tmp_path, monkeypatch):
    S = mod.SISKOP
    url = lambda off: f"{S}/lowongan/load_sip_record/{off}?jabatan=&negara=&sektor=&p3mi=&pendidikan=&urutan=1&berdasarkan=1&sudah_filter="  # noqa: E731
    first = [rec(1, NEGARA="Kamboja"), rec(2, SEKTOR_ID="001.006.002"), rec(3), rec(4, P3MI="co 3"), rec(5), rec(6, P3MI="CO 6"), rec(7, SEKTOR_ID=None), rec(8)]
    pages = {
        url(0): (200, board_page(first)),
        f"{S}/lowongan/detail/3": (200, BOARD),
        f"{S}/lowongan/detail/5": (200, "<p>no description</p>"),
        f"{S}/lowongan/detail/6": (500, ""),
        f"{S}/lowongan/detail/8": (200, BOARD),
    }
    monkeypatch.setattr(mod, "fetch", fake_fetch(pages))
    mod.cmd_negatives(tmp_path, want=2)
    picked = json.loads((tmp_path / "negatives.json").read_text())
    assert [p["js_id"] for p in picked] == [3, 8] and picked[0]["sip_no"] == "SIP-123"
    reasons = [json.loads(l)["reason"] for l in (tmp_path / "rejects-negatives.jsonl").read_text().splitlines()]
    assert reasons == ["N4_destination", "N2_not_formal_sector", "N3_company_already_collected", "N1_no_description", "N1_no_description", "N2_not_formal_sector"]
    assert (tmp_path / "board" / "3.html").exists()


def test_cmd_negatives_pages_through_the_board_and_stops_when_it_runs_dry(mod, tmp_path, monkeypatch):
    S = mod.SISKOP
    url = lambda off: f"{S}/lowongan/load_sip_record/{off}?jabatan=&negara=&sektor=&p3mi=&pendidikan=&urutan=1&berdasarkan=1&sudah_filter="  # noqa: E731
    pages = {
        url(0): (200, board_page([rec(1), rec(2, NEGARA=None)])),
        url(2): (200, board_page([rec(3)])),
        url(3): (500, ""),
        f"{S}/lowongan/detail/1": (200, BOARD),
        f"{S}/lowongan/detail/3": (200, BOARD),
        f"{S}/lowongan/detail/2": (200, BOARD),
    }
    monkeypatch.setattr(mod, "fetch", fake_fetch(pages))
    mod.cmd_negatives(tmp_path, want=40)
    assert [p["js_id"] for p in json.loads((tmp_path / "negatives.json").read_text())] == [1, 2, 3]


def test_excerpt_ok(mod):
    page = "Korban dijanjikan gaji besar. Perekrut bernama Budi menghubungi korban lewat WhatsApp."
    assert mod.excerpt_ok("Korban dijanjikan gaji besar", page) is True
    assert mod.excerpt_ok("Perekrut bernama [nama] menghubungi korban [nomor]", page) is True
    assert mod.excerpt_ok("[nama]", page) is True
    assert mod.excerpt_ok("Korban dijanjikan gaji kecil", page) is False
    assert mod.excerpt_ok("menghubungi korban ... Korban dijanjikan", page) is False


def write_rows(path, rows):
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n\n")
    return path


def test_cmd_verify(mod, tmp_path, capsys):
    url = "https://www.jpnn.com/news/1"
    (tmp_path / "pages").mkdir()
    (tmp_path / "pages" / f"{mod.cache_key(url)}.json").write_text(json.dumps({"text": "Korban dijanjikan gaji besar oleh perekrut tidak resmi."}))
    good = {"kind": "positive", "source_url": url, "ad_text_as_reported": "Korban dijanjikan gaji besar", "published": "2026-02-01"}
    rows = write_rows(tmp_path / "rows.jsonl", [good, {**good, "ad_text_as_reported": "teks lain\nKorban dijanjikan gaji besar"}, {**good, "published": "2030-01-01"},
                                                {**good, "ad_text_as_reported": "Hubungi 0812-3456-7890"},
                                                {"kind": "negative", "source_url": "u", "ad_text": "Lowongan resmi"}, {"kind": "negative", "ad_text": None}])
    assert mod.cmd_verify(tmp_path, rows) == 1
    out = capsys.readouterr().out
    assert "not verbatim" in out and "out of range" in out and "phone digits" in out and "4 failing" not in out and "verify: 3 failing row(s)" in out
    assert mod.cmd_verify(tmp_path, write_rows(tmp_path / "ok.jsonl", [good])) == 0


def make_rows(n_pos, n_neg):
    rows = []
    for i in range(n_pos):
        company = f"PT Co {i // 3}" if i % 5 else None  # groups of up to 3 rows share a company
        rows.append({"kind": "positive", "source_url": f"https://news.example/{i}", "ad_text_as_reported": f"iklan {i}", "company_as_reported": company})
    for i in range(n_neg):
        rows.append({"kind": "negative", "source_url": f"https://board.example/{i}", "ad_text": f"resmi {i}", "company": f"CV {i}" if i % 4 else ""})
    return rows


def test_cmd_split_assigns_sets_ids_and_a_manifest(mod, tmp_path, capsys):
    rows = write_rows(tmp_path / "rows.jsonl", make_rows(95, 30))
    out = tmp_path / "bench"
    out.mkdir()
    mod.cmd_split(rows, out)
    manifest = json.loads((out / "MANIFEST.json").read_text())
    assert manifest["seed"] == mod.SEED and manifest["sets"]["unused"]["file"] is None and manifest["sets"]["unused"]["file_sha256"] is None
    assert manifest["sets"]["dev"]["positives"] == 20 and manifest["sets"]["dev"]["negatives"] == 5
    total = sum(m["positives"] + m["negatives"] for m in manifest["sets"].values())
    assert total == 125 and manifest["sets"]["unused"]["positives"] > 0
    ids = list(manifest["sets"]["dev"]["rows"])
    assert ids[0].startswith("d-") and any(i.startswith("t1-") for i in manifest["sets"]["tranche1"]["rows"]) and any(i.startswith("u-") for i in manifest["sets"]["unused"]["rows"])
    assert not (out / "unused.jsonl").exists() and (out / "dev.jsonl").exists()
    assert "dev: 20 positives, 5 negatives" in capsys.readouterr().out


def test_cmd_split_fills_the_second_tranche_when_the_first_is_full(mod, tmp_path):
    # one big company group lands in a tranche and fills it early; the rest must spill to the other tranche, then to "unused"
    rows = [{"kind": "positive", "source_url": f"u{i}", "ad_text_as_reported": f"t{i}", "company_as_reported": "PT Big" if i < 24 else f"PT C{i}"} for i in range(110)]
    path = write_rows(tmp_path / "rows.jsonl", rows)
    out = tmp_path / "bench"
    out.mkdir()
    mod.cmd_split(path, out)
    manifest = json.loads((out / "MANIFEST.json").read_text())
    sizes = {s: m["positives"] for s, m in manifest["sets"].items()}
    assert sizes["dev"] == 20 and sum(sizes.values()) == 110 and sizes["tranche1"] > 0 and sizes["tranche2"] > 0


def test_main_dispatches_every_command(mod, tmp_path, monkeypatch):
    calls = []
    for name in ("listings", "listings_a1", "listings_a2", "fetch", "prefilter", "negatives", "split"):
        monkeypatch.setattr(mod, f"cmd_{name}", lambda *a, _n=name, **k: calls.append((_n, a, k)))
    monkeypatch.setattr(mod, "cmd_verify", lambda cache, rows: 3)
    cache = str(tmp_path / "c")
    for cmd in ("listings", "listings-a1", "listings-a2", "fetch", "prefilter", "prefilter-a1", "prefilter-a2", "negatives", "split"):
        monkeypatch.setattr(sys, "argv", ["collect", cmd, "--cache", cache, "--rows", "r.jsonl", "--want", "7"])
        assert mod.main() == 0
    monkeypatch.setattr(sys, "argv", ["collect", "verify", "--cache", cache, "--rows", "r.jsonl"])
    assert mod.main() == 3
    names = [c[0] for c in calls]
    assert names == ["listings", "listings_a1", "listings_a2", "fetch", "prefilter", "prefilter", "prefilter", "negatives", "split"]
    assert calls[5][2] == {"amendment": 1} and calls[6][2] == {"amendment": 2} and calls[7][1][1] == 7


def test_main_ignores_a_command_it_does_not_know(mod, tmp_path, monkeypatch):
    ns = type("NS", (), {"command": "bogus", "cache": tmp_path / "c", "rows": None, "out": tmp_path, "want": 1})()
    monkeypatch.setattr(mod.argparse.ArgumentParser, "parse_args", lambda self: ns)
    assert mod.main() == 0


def test_runs_as_a_script():
    assert run_as_main("collect", "--help") == 0
