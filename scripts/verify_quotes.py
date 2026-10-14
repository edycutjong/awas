#!/usr/bin/env python3
"""Re-check every quote an evidence file shows, against the cited page, with no key and no Awas code.

    python3 scripts/verify_quotes.py https://<app>/case/<id>          # a shared evidence file
    python3 scripts/verify_quotes.py pack.json                         # a stored pack
    python3 scripts/verify_quotes.py --bench bench/results-t2.jsonl    # every shown quote of a committed bench run
    python3 scripts/verify_quotes.py --tavily https://<app>/case/<id>  # re-check through Tavily extract (spends credits)

For each shown line: GET the URL, strip the HTML, normalise (lowercase, ASCII quotes, one space) and look for the
quote. Verdicts: present · changed since fetch (the page answered but the quote is gone) · unverifiable by plain GET
(JavaScript-rendered page, PDF, or the site refuses scripts). Awas checked the quote against the text Tavily returned
at the time; `pageSha256` in the pack is the hash of that text, so a page that changed later can still be told apart.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[‘’‚‛′]", "'", s)
    s = re.sub(r"[“”„‟″]", '"', s)
    s = re.sub(r"[‐-―−]", "-", s)
    s = re.sub(r"[​-‍⁠﻿­]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def page_text(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read()
            if "pdf" in ctype:
                return r.status, ""
            body = raw.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""
    body = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", " ", body, flags=re.S)
    return 200, html.unescape(re.sub(r"<[^>]+>", " ", body))


def tavily_text(url: str) -> str:
    key = os.environ.get("TAVILY_API_KEY")
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {"X-Tavily-Access-Mode": "keyless"})}
    req = urllib.request.Request("https://api.tavily.com/extract", method="POST", headers=headers, data=json.dumps({"urls": [url]}).encode())
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.loads(r.read()).get("results", [])
    return res[0].get("raw_content", "") if res else ""


def check_line(line: dict, use_tavily: bool) -> str:
    q = norm(line["quote"])
    if use_tavily:
        return "present" if q in norm(tavily_text(line["url"])) else "changed since fetch"
    status, text = page_text(line["url"])
    if status != 200 or len(text) < 400:
        return "unverifiable by plain GET"
    return "present" if q in norm(text) else ("unverifiable by plain GET" if len(norm(text)) < 2000 else "changed since fetch")


def load_packs(target: str, bench: bool) -> list[dict]:
    if bench:
        return [json.loads(l).get("full_pack") or {} for l in Path(target).read_text().splitlines() if l.strip()]
    if target.startswith("http"):
        url = target.replace("/case/", "/api/case/") if "/api/case/" not in target else target
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
            return [json.loads(r.read())]
    return [json.loads(Path(target).read_text())]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target")
    ap.add_argument("--bench", action="store_true")
    ap.add_argument("--tavily", action="store_true")
    a = ap.parse_args()
    counts: dict[str, int] = {}
    for pack in load_packs(a.target, a.bench):
        for line in pack.get("lines", []):
            if line.get("status") != "verified":
                continue
            v = check_line(line, a.tavily)
            counts[v] = counts.get(v, 0) + 1
            print(f"{v:<27} {line['url'][:90]}\n{'':<27} “{line['quote'][:110]}”")
    print("\n" + " · ".join(f"{k}: {n}" for k, n in sorted(counts.items())) if counts else "no shown lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
