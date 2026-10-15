#!/usr/bin/env python3
"""Day-0 stages R, V and V-time over the dev positives (spec §6), through the app's own code path (bench mode).

    python3 scripts/stage_rv.py r     --base http://localhost:3000 --out docs/proof/stage-r.json
    python3 scripts/stage_rv.py v     --base http://localhost:3000 --out docs/proof/stage-v.json
    python3 scripts/stage_rv.py vtime --base http://localhost:3000 --out docs/proof/stage-v-time.json

R      rubric only (keyword/regex rules on the raw text, no model, no search, 0 credits): how many dev positives STOP
       on the rules alone. Reported either way; it picks the frame rule (>= 15/20 or <= 14/20).
V      the full pipeline with the bench-mode held-out rule (`exclude` = the row's source domain + near-duplicate
       titles): what Tavily returned per case (titles, URLs), which lines the quote gate verified, and the
       company-matched lines. Whether a returned item is "relevant" is a reading, not code: it is recorded separately.
V-time the company exact_match search with `end_date` = published - 1 day, on the dev positives whose text names a
       company, scored by the gate code (entity AND negative AND NOT guard). Fewer than 8 such rows = inconclusive.
Needs AWAS_BENCH_SECRET (the value the app was started with).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from pathlib import Path


def domain(url: str) -> str:
    host = url.split("/")[2].lower()
    return host[4:] if host.startswith("www.") else host


def run(base: str, secret: str, row: dict, stage: str, end_date: str | None = None) -> tuple[dict | None, float]:
    body = {"adText": row["ad_text_as_reported"], "lang": "id", "stage": stage,
            "exclude": {"domain": domain(row["source_url"]), "title": row.get("source_title") or ""}}
    if end_date:
        body["endDate"] = end_date
    req = urllib.request.Request(f"{base}/api/check", method="POST", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-awas-bench": secret})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=330) as r:
        text = r.read().decode()
    secs = time.time() - t0
    case_id = next((json.loads(b.split("data: ", 1)[1]).get("caseId") for b in text.split("\n\n") if b.startswith("event: done")), None)
    if not case_id:
        return None, secs
    with urllib.request.urlopen(f"{base}/api/case/{case_id}", timeout=60) as r:
        return json.loads(r.read()), secs


def company_matched(line: dict) -> bool:
    return (line.get("status") == "verified" and line.get("purpose") != "pattern" and line.get("entity") and not line.get("entityCapped")
            and line.get("entityKind") == "company" and line.get("negative") and not line.get("guard"))


def names_company(row: dict) -> bool:
    c = (row.get("company_as_reported") or "").lower().replace("pt.", "pt")
    return bool(c) and c in row["ad_text_as_reported"].lower().replace("pt.", "pt")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["r", "v", "vtime"])
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--dev", default="bench/dev.jsonl")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    secret = os.environ.get("AWAS_BENCH_SECRET")
    if not secret:
        print("AWAS_BENCH_SECRET is required", file=sys.stderr)
        return 2
    rows = [r for r in (json.loads(l) for l in Path(a.dev).read_text().splitlines() if l.strip()) if r["kind"] == "positive"]
    report: dict = {"stage": a.stage, "recorded_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "rows": []}

    if a.stage == "r":
        for row in rows:
            pack, secs = run(a.base, secret, row, "rubric")
            flags = [{"id": f["id"], "class": f["class"], "span": f["span"]["text"]} for f in (pack or {}).get("flags", [])]
            report["rows"].append({"id": row["id"], "verdict": (pack or {}).get("verdict"), "flags": flags})
            print(f"  {row['id']} {(pack or {}).get('verdict')} {[f['id'] for f in flags]}", file=sys.stderr)
        n = sum(1 for r in report["rows"] if r["verdict"] == "STOP")
        report["summary"] = {"positives": len(rows), "stop_on_rules_alone": n,
                             "frame": "the rule stops it; the evidence convinces the nephew" if n >= 15 else "lead with evidence-flipped STOPs",
                             "verdicts": {v: sum(1 for r in report["rows"] if r["verdict"] == v) for v in ("STOP", "VERIFY_FIRST", "NO_RED_FLAGS_FOUND")}}

    elif a.stage == "v":
        for row in rows:
            pack, secs = run(a.base, secret, row, "full")
            pack = pack or {}
            calls = [{"method": t["method"], "purpose": t["purpose"], "query": (t.get("params") or {}).get("query"),
                      "credits": t.get("credits"), "results": [{"url": u, "title": (t.get("titles") or [None] * len(t["urls"]))[i]}
                                                              for i, u in enumerate(t.get("urls", []))], "error": t.get("error")} for t in pack.get("tavily", [])]
            lines = [{"url": l["url"], "status": l["status"], "reason": l.get("reason"), "purpose": l.get("purpose"), "quote": l["quote"],
                      "negative": l.get("negative"), "entity": l.get("entity"), "company_matched": company_matched(l)} for l in pack.get("lines", [])]
            report["rows"].append({"id": row["id"], "seconds": round(secs, 1), "verdict": pack.get("verdict"), "rule": pack.get("rule"),
                                   "excluded_domain": domain(row["source_url"]), "tavily": calls, "lines": lines,
                                   "verified_lines": sum(1 for l in lines if l["status"] == "verified"),
                                   "verified_negative_lines": sum(1 for l in lines if l["status"] == "verified" and l["negative"]),
                                   "company_matched_lines": sum(1 for l in lines if l["company_matched"]),
                                   "failed": (pack.get("receipt") or {}).get("failedSteps"), "credits": (pack.get("receipt") or {}).get("tavilyCredits"),
                                   "case_id": pack.get("id")})
            print(f"  {row['id']} {secs:.0f}s {pack.get('verdict')} results={sum(len(c['results']) for c in calls)} "
                  f"verified={report['rows'][-1]['verified_lines']} cm={report['rows'][-1]['company_matched_lines']}", file=sys.stderr)
        rs = report["rows"]
        report["summary"] = {"positives": len(rs), "cases_with_any_result": sum(1 for r in rs if any(c["results"] for c in r["tavily"])),
                             "cases_with_verified_negative_line": sum(1 for r in rs if r["verified_negative_lines"] > 0),
                             "cases_with_company_matched_line": sum(1 for r in rs if r["company_matched_lines"] > 0),
                             "credits": sum(r["credits"] or 0 for r in rs),
                             "relevant_count": "recorded separately (a reading of the titles and verified lines, not code)"}

    else:
        named = [r for r in rows if names_company(r)]
        for row in named:
            end = (dt.date.fromisoformat(row["published"][:10]) - dt.timedelta(days=1)).isoformat()
            pack, secs = run(a.base, secret, row, "full", end_date=end)
            pack = pack or {}
            cm = [l for l in pack.get("lines", []) if company_matched(l)]
            report["rows"].append({"id": row["id"], "end_date": end, "company_matched_lines": len(cm), "verdict": pack.get("verdict"),
                                   "case_id": pack.get("id"), "company_search": [t for t in pack.get("tavily", []) if t["purpose"] == "company"]})
        k = sum(1 for r in report["rows"] if r["company_matched_lines"] > 0)
        report["summary"] = {"dev_positives": len(rows), "naming_a_company": len(named), "company_matched_before_publication": k,
                             "result": "inconclusive (fewer than 8 dev positives name a company) — treated as a fail" if len(named) < 8
                             else ("pass" if k >= 0.25 * len(named) else "fail")}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(report["summary"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
