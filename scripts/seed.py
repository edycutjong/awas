#!/usr/bin/env python3
"""Benchmark set checks and recorded samples. Stdlib only.

    python3 scripts/seed.py --check [--no-net]      # validate bench/*.jsonl; x per tranche; HEAD every source_url
    python3 scripts/seed.py --samples --base URL     # record the /judge samples from bench/samples.json (live runs)

--check fails on: a row missing a field; any phone-number-like digits ("0812-3456-7890", "+62 812 …"); a URL that
appears in two sets; a case or company shared between dev and a tranche (or between a sample and any benchmark row);
a MANIFEST hash that no longer matches its row; a source URL that does not answer 200 (unless --no-net).
x = positives whose ad_text_as_reported contains company_as_reported — computed here, never typed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BENCH = Path("bench")
SETS = ["dev", "tranche1", "tranche2"]
PHONE = re.compile(r"(\+?62|0)8\d{7,}")
POS_FIELDS = ["id", "set", "kind", "source_url", "source_title", "published", "ad_text_as_reported", "paraphrased", "redactions", "sha256"]
NEG_FIELDS = ["id", "set", "kind", "source_url", "ad_text", "company", "sha256"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"


def load(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()] if path.exists() else []


def canonical(row: dict) -> str:
    return json.dumps({k: v for k, v in row.items() if k not in ("id", "set", "sha256")}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def norm_company(s: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\b(pt|cv)\.", r"\1", (s or "").lower())).strip()


def head(url: str) -> int:
    for method in ("HEAD", "GET"):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method=method, headers={"User-Agent": UA}), timeout=30) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if method == "GET":
                return e.code
        except Exception:
            if method == "GET":
                return 0
    return 0


def check(net: bool) -> int:
    problems: list[str] = []
    sets = {s: load(BENCH / f"{s}.jsonl") for s in SETS}
    manifest = json.loads((BENCH / "MANIFEST.json").read_text()) if (BENCH / "MANIFEST.json").exists() else None
    samples = json.loads((BENCH / "samples.json").read_text()).get("samples", []) if (BENCH / "samples.json").exists() else []

    urls: dict[str, str] = {}
    companies: dict[str, str] = {}
    for s, rows in sets.items():
        for r in rows:
            need = POS_FIELDS if r.get("kind") == "positive" else NEG_FIELDS
            missing = [f for f in need if f not in r]
            if missing:
                problems.append(f"{s}/{r.get('id')}: missing {missing}")
            text = r.get("ad_text_as_reported") or r.get("ad_text") or ""
            if PHONE.search(re.sub(r"[\s.\-]", "", text)):
                problems.append(f"{s}/{r.get('id')}: phone-number digits in the ad text")
            if r.get("sha256") != hashlib.sha256(canonical(r).encode()).hexdigest():
                problems.append(f"{s}/{r.get('id')}: row changed since it was hashed")
            if manifest and manifest["sets"].get(s, {}).get("rows", {}).get(r.get("id")) != r.get("sha256"):
                problems.append(f"{s}/{r.get('id')}: not in MANIFEST.json with this hash")
            u = r.get("source_url")
            if u in urls and urls[u] != s:
                problems.append(f"{u} appears in {urls[u]} and {s}")
            urls[u] = s
            c = norm_company(r.get("company_as_reported") or r.get("company"))
            if c:
                if c in companies and companies[c] != s:
                    problems.append(f"company {c!r} appears in {companies[c]} and {s}")
                companies[c] = s
    if manifest:
        for s in SETS:
            body = (BENCH / f"{s}.jsonl").read_text() if (BENCH / f"{s}.jsonl").exists() else ""
            if manifest["sets"].get(s, {}).get("file_sha256") not in (None, hashlib.sha256(body.encode()).hexdigest()):
                problems.append(f"bench/{s}.jsonl: file hash differs from MANIFEST.json")
    for smp in samples:
        u = smp.get("source_url")
        if u and u in urls:
            problems.append(f"sample {smp.get('slug')}: source {u} is a benchmark row ({urls[u]})")
        c = norm_company(smp.get("company"))
        if c and c in companies:
            problems.append(f"sample {smp.get('slug')}: company {c!r} is in benchmark set {companies[c]}")

    summary = {}
    for s, rows in sets.items():
        pos = [r for r in rows if r["kind"] == "positive"]
        x = [r for r in pos if r.get("company_as_reported") and norm_company(r["company_as_reported"]) in norm_company(r["ad_text_as_reported"])]
        summary[s] = {"positives": len(pos), "negatives": len(rows) - len(pos), "x_positives_naming_company": len(x),
                      "paraphrased": sum(1 for r in pos if r.get("paraphrased"))}
    print(json.dumps(summary, indent=1))

    if net:
        for u, s in sorted(urls.items(), key=lambda kv: kv[1]):
            st = head(u)
            if st != 200:
                problems.append(f"{s}: {u} answered {st}")
            time.sleep(0.3)
    for p in problems:
        print("FAIL", p)
    print(f"seed --check: {'OK' if not problems else f'{len(problems)} problem(s)'}")
    return 1 if problems else 0


def record_samples(base: str) -> int:
    """Record each sample in bench/samples.json as a real live run, then store it under samples/ via the app."""
    secret = os.environ.get("AWAS_BENCH_SECRET")
    judge = os.environ.get("AWAS_JUDGE_CODE")
    if not (secret and judge):
        print("AWAS_BENCH_SECRET and AWAS_JUDGE_CODE are required", file=sys.stderr)
        return 2
    spec = json.loads((BENCH / "samples.json").read_text())
    for smp in spec["samples"]:
        req = urllib.request.Request(f"{base}/api/check?judge={urllib.parse.quote(judge)}", method="POST",
                                     data=json.dumps({"adText": smp["ad_text"], "lang": smp.get("lang", "id")}).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=320) as r:
            body = r.read().decode()
        case_id = next((json.loads(b.split("data: ", 1)[1]).get("caseId") for b in body.split("\n\n") if b.startswith("event: done")), None)
        if not case_id:
            print(f"  {smp['slug']}: no case id", file=sys.stderr)
            continue
        req = urllib.request.Request(f"{base}/api/samples", method="POST",
                                     data=json.dumps({"caseId": case_id, "slug": smp["slug"], "label": smp["label"]}).encode(),
                                     headers={"Content-Type": "application/json", "x-awas-bench": secret})
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"  {smp['slug']}: case {case_id} → {json.loads(r.read()).get('stored')}", file=sys.stderr)
    return 0


def main() -> int:
    import urllib.parse  # noqa: F401  (used in record_samples)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--no-net", action="store_true")
    ap.add_argument("--samples", action="store_true")
    ap.add_argument("--base", default="http://localhost:3000")
    a = ap.parse_args()
    if a.check:
        return check(not a.no_net)
    if a.samples:
        return record_samples(a.base)
    ap.print_help()
    return 2


if __name__ == "__main__":
    import urllib.parse
    sys.exit(main())
