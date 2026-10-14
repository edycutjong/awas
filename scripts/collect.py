#!/usr/bin/env python3
"""Benchmark collection, exactly as bench/PROTOCOL.md describes it. Stdlib only.

    python3 -I scripts/collect.py listings  --cache DIR      # named listings -> article URLs in page order
    python3 -I scripts/collect.py fetch     --cache DIR      # article text (cached; polite, sequential)
    python3 -I scripts/collect.py prefilter --cache DIR      # Q1 on-topic + Q6 date range, rejects logged
    python3 -I scripts/collect.py negatives --cache DIR      # official SISKOP2MI vacancy board (N1-N4)
    python3 -I scripts/collect.py verify    --cache DIR --rows ROWS.jsonl   # Q3 verbatim + Q4 no phones
    python3 -I scripts/collect.py split     --cache DIR --rows ROWS.jsonl --out bench/

The cache directory holds downloaded pages (third-party text, never committed). Rows are written by a reader
following PROTOCOL.md §2 Q2-Q5; `verify` refuses any excerpt that is not verbatim on the cached page.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
SEED = 20261014
DATE_FROM, DATE_TO = "2022-01-01", "2026-10-13"

# PROTOCOL.md §2, in order. (name, base, page-URL builder, pages)
LISTINGS = [
    ("antara-tppo-kamboja", "https://www.antaranews.com/tag/tppo-kamboja", lambda b, p: b if p == 1 else f"{b}/{p}", 6),
    ("antara-tppo-myanmar", "https://www.antaranews.com/tag/tppo-myanmar", lambda b, p: b if p == 1 else f"{b}/{p}", 3),
    ("antara-online-scam", "https://www.antaranews.com/tag/online-scam", lambda b, p: b if p == 1 else f"{b}/{p}", 3),
    ("kompas-tppo-kamboja", "https://www.kompas.com/tag/tppo-kamboja", lambda b, p: b if p == 1 else f"{b}?page={p}", 4),
    ("kompas-tppo-myanmar", "https://www.kompas.com/tag/tppo-myanmar", lambda b, p: b if p == 1 else f"{b}?page={p}", 2),
    ("detik-tppo-kamboja", "https://www.detik.com/tag/tppo-kamboja", lambda b, p: b if p == 1 else f"{b}/?sortby=time&page={p}", 3),
    ("liputan6-tppo-kamboja", "https://www.liputan6.com/tag/tppo-kamboja", lambda b, p: b if p == 1 else f"{b}?page={p}", 3),
    ("cnn-tppo-kamboja", "https://www.cnnindonesia.com/tag/tppo-kamboja", lambda b, p: b, 1),
    ("cnn-online-scam", "https://www.cnnindonesia.com/tag/online-scam", lambda b, p: b, 1),
]

# PROTOCOL.md Amendment 1 — appended after listings 1-8; (name, base, page-URL builder, first page, last page)
AMENDMENT_1 = [
    ("antara-tppo", "https://www.antaranews.com/tag/tppo", lambda b, p: b if p == 1 else f"{b}/{p}", 1, 30),
    ("kompas-tppo", "https://www.kompas.com/tag/tppo", lambda b, p: b if p == 1 else f"{b}?page={p}", 1, 15),
    ("antara-pmi-ilegal", "https://www.antaranews.com/tag/pmi-ilegal", lambda b, p: b if p == 1 else f"{b}/{p}", 1, 8),
    ("kompas-tppo-kamboja-5-10", "https://www.kompas.com/tag/tppo-kamboja", lambda b, p: b if p == 1 else f"{b}?page={p}", 5, 10),
]

OFFER_WORDS = re.compile(
    r"\b(dijanjikan|diiming-imingi|iming-iming|ditawari|ditawarkan|tawaran|menawarkan|lowongan|loker|iklan|gaji|upah|"
    r"direkrut|merekrut|perekrut|tergiur|bekerja sebagai|kerja di)\b",
    re.I,
)

# An article of the listing's own outlet. Links with a query string are widgets ("popular", "trending"), not the listing.
ARTICLE = {
    "antaranews.com": re.compile(r'href="(https://www\.antaranews\.com/berita/\d+/[a-z0-9-]+)"'),
    "kompas.com": re.compile(r'href="(https://[a-z]+\.kompas\.com/read/\d{4}/\d{2}/\d{2}/\d+/[a-z0-9-]+)"'),
    "detik.com": re.compile(r'href="(https://[a-z]+\.detik\.com/(?:[a-z0-9-]+/)*d-\d+/[a-z0-9-]+)"'),
    "liputan6.com": re.compile(r'href="(https://www\.liputan6\.com/[a-z-]+/read/\d+/[a-z0-9-]+)"'),
    "cnnindonesia.com": re.compile(r'href="(https://www\.cnnindonesia\.com/[a-z-]+/\d{14}-\d+-\d+/[a-z0-9-]+)"'),
}

ON_TOPIC = re.compile(
    r"\b(tppo|perdagangan orang|online scam|online scamming|penipuan daring|penipuan online|scammer|scamming|"
    r"non[- ]?prosedural|ilegal)\b",
    re.I,
)
ABROAD = re.compile(
    r"\b(kamboja|myanmar|laos|thailand|filipina|vietnam|malaysia|uni emirat arab|dubai|arab saudi|taiwan|"
    r"hong kong|korea|jepang|tiongkok|china|turki|luar negeri)\b",
    re.I,
)
PHONE = re.compile(r"(\+?62|0)8\d{7,}")


def fetch(url: str, timeout: int = 30, headers: dict | None = None) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.geturl(), res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:  # network errors are recorded, never retried silently
        return 0, url, f"ERROR {type(e).__name__}: {e}"


def domain(url: str) -> str:
    host = re.sub(r"^https?://", "", url).split("/")[0]
    return ".".join(host.split(".")[-2:])


def cache_key(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def norm(s: str) -> str:
    """Same normalisation the quote gate uses: NFKC, ASCII quotes and dashes, one space."""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‘’‚‛′]", "'", s)
    s = re.sub(r"[“”„‟″]", '"', s)
    s = re.sub(r"[‐-―−]", "-", s)
    return re.sub(r"\s+", " ", s).strip()


def page_text(raw: str) -> tuple[str, str | None, str | None]:
    """Article text from <p> paragraphs, plus the JSON-LD headline and publish date."""
    title = published = None
    for block in re.findall(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", raw, re.S):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for it in items:
            if isinstance(it, dict) and it.get("@type") in ("NewsArticle", "Article", "ReportageNewsArticle"):
                title = title or it.get("headline")
                published = published or it.get("datePublished")
    if not published:
        m = re.search(r'<meta[^>]+(?:property|name)="(?:article:published_time|publishdate|pubdate)"[^>]+content="([^"]+)"', raw)
        published = m.group(1) if m else None
    if not title:
        m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', raw)
        title = html.unescape(m.group(1)) if m else None
    body = re.sub(r"<!--.*?-->|<script.*?</script>|<style.*?</style>", "", raw, flags=re.S)
    paras = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S):
        t = norm(html.unescape(re.sub(r"<[^>]+>", " ", p)))
        if len(t) >= 30 and not re.match(r"^(baca juga|simak juga|lihat juga|advertisement)\b", t, re.I):
            paras.append(t)
    return "\n".join(paras), (norm(title) if title else None), published


def cmd_listings(cache: Path) -> None:
    out, seen = [], set()
    for name, base, page_url, pages in LISTINGS:
        pattern = ARTICLE[domain(base)]
        for p in range(1, pages + 1):
            url = page_url(base, p)
            status, _, raw = fetch(url)
            links = []
            for link in pattern.findall(raw):
                if link not in links:
                    links.append(link)
            print(f"{status} {url}: {len(links)} article links", file=sys.stderr)
            for pos, link in enumerate(links, 1):
                if link in seen:
                    continue
                seen.add(link)
                out.append({"listing": name, "listing_page": p, "listing_position": len(out) + 1, "url": link})
            time.sleep(0.8)
    (cache / "listings.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"{len(out)} article URLs -> {cache / 'listings.json'}")


def cmd_listings_a1(cache: Path) -> None:
    """Amendment 1: crawl the added listings and APPEND new links; pass-1 positions never change."""
    path = cache / "listings.json"
    out = json.loads(path.read_text())
    seen = {r["url"] for r in out}
    for name, base, page_url, first, last in AMENDMENT_1:
        pattern = ARTICLE[domain(base)]
        for p in range(first, last + 1):
            url = page_url(base, p)
            status, _, raw = fetch(url)
            links = list(dict.fromkeys(pattern.findall(raw)))
            added = 0
            for link in links:
                if link in seen:
                    continue
                seen.add(link)
                out.append({"listing": name, "listing_page": p, "listing_position": len(out) + 1, "url": link, "amendment": 1})
                added += 1
            print(f"{status} {url}: {len(links)} links, {added} new", file=sys.stderr)
            time.sleep(0.8)
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"{len(out)} article URLs in total -> {path}")


def cmd_fetch(cache: Path) -> None:
    pages = cache / "pages"
    pages.mkdir(exist_ok=True)
    rows = json.loads((cache / "listings.json").read_text())
    for i, row in enumerate(rows, 1):
        dest = pages / f"{cache_key(row['url'])}.json"
        if dest.exists():
            continue
        status, final, raw = fetch(row["url"])
        text, title, published = page_text(raw) if status == 200 else ("", None, None)
        dest.write_text(json.dumps({"url": row["url"], "final_url": final, "http": status, "title": title,
                                    "published": published, "text": text}, ensure_ascii=False))
        print(f"[{i}/{len(rows)}] {status} {len(text)}c {row['url']}", file=sys.stderr)
        time.sleep(0.7)


def cmd_prefilter(cache: Path, amendment: int = 0) -> None:
    rows = [r for r in json.loads((cache / "listings.json").read_text()) if r.get("amendment", 0) == amendment]
    candidates, rejects = [], []
    for row in rows:
        page = json.loads((cache / "pages" / f"{cache_key(row['url'])}.json").read_text())
        day = (page.get("published") or "")[:10]
        if page["http"] != 200 or not page["text"]:
            rejects.append({**row, "reason": "unfetchable", "http": page["http"]})
        elif not day or not (DATE_FROM <= day <= DATE_TO):
            rejects.append({**row, "reason": "out_of_range", "published": day or None})
        elif not (ON_TOPIC.search(page["text"]) and ABROAD.search(page["text"])):
            rejects.append({**row, "reason": "off_topic", "title": page["title"]})
        elif amendment and not OFFER_WORDS.search(page["text"]):
            rejects.append({**row, "reason": "no_offer_detail", "note": "Q2 pre-screen: no offer word", "title": page["title"]})
        else:
            candidates.append({**row, "title": page["title"], "published": day, "chars": len(page["text"]),
                               "page": f"pages/{cache_key(row['url'])}.json"})
    suffix = f"-a{amendment}" if amendment else ""
    (cache / f"candidates{suffix}.json").write_text(json.dumps(candidates, indent=1, ensure_ascii=False))
    with open(cache / f"rejects-prefilter{suffix}.jsonl", "w") as f:
        for r in rejects:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    reasons = sorted({r["reason"] for r in rejects})
    tally = ", ".join(f"{k}:{sum(1 for r in rejects if r['reason'] == k)}" for k in reasons)
    print(f"{len(candidates)} candidates, {len(rejects)} rejected ({tally})")


SISKOP = "https://siskop2mi.bp2mi.go.id"
EXCLUDED_DESTINATIONS = {"kamboja", "myanmar", "laos"}


def board_text(raw: str, rec: dict) -> tuple[str, dict]:
    """What the board displays for one vacancy, in display order: the listing card (position, the foreign
    employer and destination, pay) and the detail page's visible job text. HTML comments are not displayed
    (the page's cost table and a template "Must Have" list are commented out), and the company's phone,
    e-mail and address are left out."""
    body = re.sub(r"<!--.*?-->|<script.*?</script>|<style.*?</style>|<select.*?</select>", "", raw, flags=re.S)
    m = re.search(r'class="content-main-right single-detail">\s*<h3>(.*?)</h3>', body, re.S)
    position = norm(html.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))) if m else ""
    # The header names the licensed company and its city (shown); its phone and e-mail spans are not taken.
    mc = re.search(r'<span class="company">(.*?)</span>\s*<span class="location">(.*?)</span>', body, re.S)
    company = norm(html.unescape(re.sub(r"<[^>]+>", " ", mc.group(1)))) if mc else ""
    city = norm(html.unescape(re.sub(r"<[^>]+>", " ", mc.group(2)))) if mc else ""
    text = html.unescape(re.sub(r"<[^>]+>", "\n", body))
    lines = [x for x in (norm(x) for x in text.split("\n")) if x]
    if "Deskripsi Pekerjaan" not in lines:
        return "", {}
    start = lines.index("Deskripsi Pekerjaan")
    end = min([lines.index(k, start) for k in ("No SIP", "Pekerjaan Lainnya") if k in lines[start:]] or [len(lines)])
    sip = lines[lines.index("No SIP") + 1] if "No SIP" in lines else None
    card = norm(f"{rec.get('AGENCY') or ''} {rec.get('NEGARA') or ''}")
    pay = norm(f"{rec.get('JOB_GAJI') or ''} {rec.get('JOB_GAJI_TYPE') or ''}") if rec.get("JOB_GAJI") else ""
    head = [x for x in (position, company, city, card, pay) if x]
    return "\n".join(head + lines[start:end]), {"position": position, "sip_no": sip}


def cmd_negatives(cache: Path, want: int) -> None:
    boards = cache / "board"
    boards.mkdir(exist_ok=True)
    picked, rejects, companies, offset, position = [], [], set(), 0, 0
    while len(picked) < want and offset < 2000:
        url = f"{SISKOP}/lowongan/load_sip_record/{offset}?jabatan=&negara=&sektor=&p3mi=&pendidikan=&urutan=1&berdasarkan=1&sudah_filter="
        status, _, raw = fetch(url, headers={"X-Requested-With": "XMLHttpRequest"})
        records = json.loads(raw).get("result", []) if status == 200 else []
        print(f"{status} offset {offset}: {len(records)} records", file=sys.stderr)
        if not records:
            break
        for rec in records:
            position += 1
            base = {"listing": "siskop2mi-board", "listing_position": position, "js_id": rec.get("JS_ID"),
                    "company": rec.get("P3MI"), "destination": rec.get("NEGARA"), "sector": rec.get("SUSAHA"),
                    "position": rec.get("JABATAN")}
            if (rec.get("NEGARA") or "").strip().lower() in EXCLUDED_DESTINATIONS:
                rejects.append({**base, "reason": "N4_destination"})
                continue
            # The board's own sector code: 001.006.001 = formal sector, 001.006.002 = informal (household) work.
            if not str(rec.get("SEKTOR_ID") or "").endswith(".001"):
                rejects.append({**base, "reason": "N2_not_formal_sector", "sektor_id": rec.get("SEKTOR_ID")})
                continue
            if (rec.get("P3MI") or "").strip().upper() in companies:
                rejects.append({**base, "reason": "N3_company_already_collected"})
                continue
            detail = f"{SISKOP}/lowongan/detail/{rec['JS_ID']}"
            st, _, page = fetch(detail)
            (boards / f"{rec['JS_ID']}.html").write_text(page)
            text, meta = board_text(page, rec) if st == 200 else ("", {})
            if not text or "Deskripsi Pekerjaan" not in text:
                rejects.append({**base, "reason": "N1_no_description", "http": st})
                continue
            companies.add(rec["P3MI"].strip().upper())
            picked.append({**base, "source_url": detail, "ad_text": text, "sip_no": meta.get("sip_no") or rec.get("SIP_NO")})
            print(f"  + {rec['P3MI']} | {rec.get('JABATAN')} | {rec.get('NEGARA')}", file=sys.stderr)
            time.sleep(0.7)
            if len(picked) >= want:
                break
        offset += len(records)
        time.sleep(0.7)
    (cache / "negatives.json").write_text(json.dumps(picked, indent=1, ensure_ascii=False))
    with open(cache / "rejects-negatives.jsonl", "w") as f:
        for r in rejects:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(picked)} negatives, {len(rejects)} rejected")


def excerpt_ok(excerpt: str, page: str) -> bool:
    """Every piece between redaction placeholders must occur verbatim, in order, on the page."""
    hay, at = norm(page), 0
    for piece in re.split(r"\[(?:nama|nomor)\]", norm(excerpt)):
        piece = piece.strip(" ,.;:")
        if not piece:
            continue
        i = hay.find(piece, at)
        if i < 0:
            return False
        at = i + len(piece)
    return True


def load_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def cmd_verify(cache: Path, rows_path: Path) -> int:
    bad = 0
    for row in load_rows(rows_path):
        problems = []
        text_field = "ad_text_as_reported" if row["kind"] == "positive" else "ad_text"
        text = row.get(text_field) or ""
        if PHONE.search(re.sub(r"[\s.\-]", "", text)):
            problems.append("phone digits")
        if row["kind"] == "positive":
            page = json.loads((cache / "pages" / f"{cache_key(row['source_url'])}.json").read_text())["text"]
            for excerpt in text.split("\n"):
                if not excerpt_ok(excerpt, page):
                    problems.append(f"not verbatim: {excerpt[:80]!r}")
            if not (DATE_FROM <= row["published"][:10] <= DATE_TO):
                problems.append("out of range")
        if problems:
            bad += 1
            print(f"FAIL {row.get('source_url')}: {'; '.join(problems)}")
    print(f"verify: {bad} failing row(s)")
    return 1 if bad else 0


def canonical(row: dict) -> str:
    return json.dumps({k: v for k, v in row.items() if k not in ("id", "set", "sha256")}, sort_keys=True,
                      ensure_ascii=False, separators=(",", ":"))


def cmd_split(rows_path: Path, out: Path) -> None:
    rows = load_rows(rows_path)
    for row in rows:
        row["sha256"] = hashlib.sha256(canonical(row).encode()).hexdigest()
    # Group by company so one company's rows always land in the same set (PROTOCOL §5.4).
    groups: dict[str, list[dict]] = {}
    for row in sorted(rows, key=lambda r: r["sha256"]):
        company = (row.get("company_as_reported") or row.get("company") or "").strip().lower()
        groups.setdefault(company or row["sha256"], []).append(row)
    order = sorted(groups, key=lambda g: groups[g][0]["sha256"])
    random.Random(SEED).shuffle(order)
    caps = {"positive": (20, 25), "negative": (5, 10)}
    counts = {k: {"dev": 0, "tranche1": 0, "tranche2": 0} for k in caps}
    turn = {k: 0 for k in caps}
    for g in order:
        kind = groups[g][0]["kind"]
        dev_cap, t_cap = caps[kind]
        c = counts[kind]
        if c["dev"] < dev_cap:
            target = "dev"
        else:
            nxt = ["tranche1", "tranche2"][turn[kind] % 2]
            other = "tranche2" if nxt == "tranche1" else "tranche1"
            target = nxt if c[nxt] < t_cap else other if c[other] < t_cap else "unused"
            turn[kind] += 1
        for row in groups[g]:
            row["set"] = target
            if target != "unused":
                c[target] += 1
    manifest = {"seed": SEED, "protocol": "bench/PROTOCOL.md", "sets": {}}
    for s in ("dev", "tranche1", "tranche2", "unused"):
        members = [r for r in rows if r["set"] == s]
        for i, r in enumerate(sorted(members, key=lambda r: (r["kind"], r["sha256"])), 1):
            r["id"] = f"{s[0] if s != 'unused' else 'u'}{s[-1] if s.startswith('tranche') else ''}-{'p' if r['kind'] == 'positive' else 'n'}{i:02d}"
        members.sort(key=lambda r: r["id"])
        body = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in members)
        if s != "unused":
            (out / f"{s}.jsonl").write_text(body)
        manifest["sets"][s] = {
            "file": f"bench/{s}.jsonl" if s != "unused" else None,
            "file_sha256": hashlib.sha256(body.encode()).hexdigest() if s != "unused" else None,
            "positives": sum(1 for r in members if r["kind"] == "positive"),
            "negatives": sum(1 for r in members if r["kind"] == "negative"),
            "rows": {r["id"]: r["sha256"] for r in members},
        }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    for s, m in manifest["sets"].items():
        print(f"{s}: {m['positives']} positives, {m['negatives']} negatives")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["listings", "listings-a1", "fetch", "prefilter", "prefilter-a1", "negatives", "verify", "split"])
    ap.add_argument("--cache", type=Path, required=True)
    ap.add_argument("--rows", type=Path)
    ap.add_argument("--out", type=Path, default=Path("bench"))
    ap.add_argument("--want", type=int, default=40)
    a = ap.parse_args()
    a.cache.mkdir(parents=True, exist_ok=True)
    if a.command == "listings":
        cmd_listings(a.cache)
    elif a.command == "fetch":
        cmd_fetch(a.cache)
    elif a.command == "listings-a1":
        cmd_listings_a1(a.cache)
    elif a.command == "prefilter":
        cmd_prefilter(a.cache)
    elif a.command == "prefilter-a1":
        cmd_prefilter(a.cache, amendment=1)
    elif a.command == "negatives":
        cmd_negatives(a.cache, a.want)
    elif a.command == "verify":
        return cmd_verify(a.cache, a.rows)
    elif a.command == "split":
        cmd_split(a.rows, a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
