#!/usr/bin/env python3
"""The benchmark: every row of a frozen set through the live app in bench mode, four columns, one file of results.

    AWAS_BENCH_SECRET=… python3 scripts/bench.py --set bench/tranche1.jsonl --base https://<app> --out bench/results-t1.jsonl
    AWAS_BENCH_SECRET=… python3 scripts/bench.py --set bench/tranche2.jsonl --base … --out … --variance 10   # + 10 rows × 2 reruns
    python3 scripts/bench.py --summarise bench/results-t1.jsonl                                              # tables only

Columns, all produced by the app's own TypeScript code path (POST /api/check, bench mode):
  rubric   — keyword/regex rules on the raw ad text, no model, no search   (stage "rubric")
  extract  — Nemotron extraction + rubric, no search                       (stage "extract")
  picker   — full run with call 2 replaced by a code sentence-picker        (inside the "full" pack, same input)
  full     — the whole pipeline                                             (stage "full")
Bench mode differs from live use in exactly four ways (DEMO.md): `exclude` (the row's own source domain and near-
duplicate titles), the secret header that skips the per-IP limit, the `stage` parameter, and an optional `endDate`.
A run whose only failure is an upstream rate limit or outage is retried (at most twice) and the retry is recorded.

As a Nebius Serverless Job (POST /api/bench/dispatch): the job has no logs over REST, so when AWAS_PUT_URL (and
AWAS_PUT_VARIANCE_URL) hold presigned Object Storage URLs, the results file is PUT there after every row — a job that
dies part-way still leaves every finished row, and a rerun with the same --out skips them.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def domain(url: str) -> str:
    host = url.split("/")[2].lower()
    return host[4:] if host.startswith("www.") else host


def post_check(base: str, secret: str, body: dict, timeout: int = 330) -> tuple[str | None, float, str]:
    req = urllib.request.Request(f"{base}/api/check", method="POST", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-awas-bench": secret})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            text = r.read().decode()
    except Exception as e:
        return None, time.time() - t0, f"{type(e).__name__}: {e}"
    case_id = None
    for block in text.split("\n\n"):
        if block.startswith("event: done"):
            case_id = json.loads(block.split("data: ", 1)[1]).get("caseId")
    return case_id, time.time() - t0, "" if case_id else "no case id in the stream"


def get_pack(base: str, case_id: str) -> dict | None:
    try:
        with urllib.request.urlopen(f"{base}/api/case/{case_id}", timeout=60) as r:
            return json.loads(r.read())
    except Exception:
        return None


TRANSIENT = ("429", "432", "433", "500", "502", "503", "504", "fetch failed", "timed out", "aborted", "time limit")


def transient_failure(pack: dict | None) -> bool:
    if pack is None:
        return True
    errs = [t.get("error") or "" for t in pack.get("tavily", [])] + [t.get("error") or "" for t in pack["receipt"].get("tf", [])]
    return any(any(k in e for k in TRANSIENT) for e in errs if e)


def put_file(path: Path, url: str | None) -> None:
    """PUT the whole file to a presigned URL (best effort: a failed upload never stops the run)."""
    if not url:
        return
    try:
        req = urllib.request.Request(url, method="PUT", data=path.read_bytes(), headers={"Content-Type": "application/x-ndjson"})
        with urllib.request.urlopen(req, timeout=60):
            pass
    except Exception as e:
        print(f"  upload failed: {type(e).__name__}: {e}", file=sys.stderr)


def run_column(base: str, secret: str, row: dict, stage: str, end_date: str | None = None) -> dict:
    text = row.get("ad_text_as_reported") or row.get("ad_text")
    body = {"adText": text, "lang": "id", "stage": stage,
            "exclude": {"domain": domain(row["source_url"]), "title": row.get("source_title") or ""}}
    if end_date:
        body["endDate"] = end_date
    attempts = []
    for attempt in range(3):
        case_id, secs, err = post_check(base, secret, body)
        pack = get_pack(base, case_id) if case_id else None
        attempts.append({"case_id": case_id, "seconds": round(secs, 2), "error": err or None})
        if stage == "rubric" or not transient_failure(pack):
            return {"pack": pack, "attempts": attempts}
        time.sleep(20 * (attempt + 1))
    return {"pack": pack, "attempts": attempts}


def company_matched(pack: dict) -> bool:
    return any(l.get("status") == "verified" and l.get("purpose") != "pattern" and l.get("entity") and not l.get("entityCapped")
               and l.get("entityKind") == "company" and l.get("negative") and not l.get("guard") for l in pack.get("lines", []))


def compact(pack: dict | None) -> dict:
    if not pack:
        return {"verdict": None}
    return {"verdict": pack.get("verdict"), "rule": pack.get("rule"), "flags": [f["id"] for f in pack.get("flags", [])],
            "never": [f["id"] for f in pack.get("flags", []) if f.get("class") == "NEVER"], "case_id": pack.get("id"),
            "failed": pack["receipt"].get("failedSteps", [])}


def bench(args) -> int:
    secret = os.environ.get("AWAS_BENCH_SECRET")
    if not secret:
        print("AWAS_BENCH_SECRET is required", file=sys.stderr)
        return 2
    rows = [json.loads(l) for l in Path(args.set).read_text().splitlines() if l.strip()]
    if args.n:
        rows = rows[: args.n]
    out = Path(args.out)
    done = {json.loads(l)["id"] for l in out.read_text().splitlines() if l.strip()} if out.exists() else set()
    with out.open("a") as f:
        for i, row in enumerate(rows, 1):
            if row["id"] in done:
                continue
            rec: dict = {"id": row["id"], "kind": row["kind"], "set": row["set"], "paraphrased": row.get("paraphrased"),
                         "names_company": bool(row.get("company_as_reported") and row["company_as_reported"].lower().replace("pt.", "pt") in
                                               (row.get("ad_text_as_reported") or "").lower().replace("pt.", "pt")),
                         "ran_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
            for stage in ("rubric", "extract", "full"):
                res = run_column(args.base, secret, row, stage)
                rec[stage] = compact(res["pack"]) | {"attempts": res["attempts"]}
                if stage == "full":
                    pack = res["pack"] or {}
                    rec["full"]["company_matched"] = company_matched(pack) if pack else False
                    rec["picker"] = {"verdict": (pack.get("picker") or {}).get("verdict"), "company_matched": (pack.get("picker") or {}).get("companyMatched")}
                    rec["full_pack"] = pack
            print(f"[{i}/{len(rows)}] {row['id']} rubric={rec['rubric']['verdict']} extract={rec['extract']['verdict']} "
                  f"full={rec['full']['verdict']} cm={rec['full'].get('company_matched')} picker={rec['picker']['verdict']}", file=sys.stderr)
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
            put_file(out, os.environ.get("AWAS_PUT_URL"))
    if args.variance:
        var_out = out.with_name(out.stem + "-variance.jsonl")
        firsts = {json.loads(l)["id"]: json.loads(l) for l in out.read_text().splitlines() if l.strip()}
        with var_out.open("a") as f:
            for row in rows[: args.variance]:
                for rep in (2, 3):
                    res = run_column(args.base, secret, row, "full")
                    f.write(json.dumps({"id": row["id"], "rep": rep, "verdict": (res["pack"] or {}).get("verdict"),
                                        "first": firsts.get(row["id"], {}).get("full", {}).get("verdict"),
                                        "case_id": (res["pack"] or {}).get("id")}) + "\n")
                    f.flush()
                    put_file(var_out, os.environ.get("AWAS_PUT_VARIANCE_URL"))
    return summarise(out)


def pct(a: int, b: int) -> str:
    return f"{a}/{b}" + (f" ({100 * a / b:.0f} %)" if b else "")


def summarise(path: Path) -> int:
    recs = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    pos = [r for r in recs if r["kind"] == "positive"]
    neg = [r for r in recs if r["kind"] == "negative"]
    x = [r for r in pos if r["names_company"]]
    cols = ["rubric", "extract", "picker", "full"]
    verdict = lambda r, c: (r.get(c) or {}).get("verdict")
    shown = [l for r in recs for l in (r.get("full_pack") or {}).get("lines", []) if l.get("status") == "verified"]
    proposed = [l for r in recs for l in (r.get("full_pack") or {}).get("lines", [])]
    # Cited-line invariant: every shown line carries a URL, a quote and the hash of the text it was checked against.
    broken = [l for l in shown if not (l.get("url") and l.get("quote") and l.get("pageSha256"))]
    secs = sorted((r.get("full_pack") or {}).get("receipt", {}).get("ms", 0) / 1000 for r in recs if r.get("full_pack"))
    tokens = sum((r.get("full_pack") or {}).get("receipt", {}).get("tfTokens", 0) for r in recs)
    credits = sum((r.get("full_pack") or {}).get("receipt", {}).get("tavilyCredits", 0) for r in recs)
    summary = {
        "file": str(path), "rows": len(recs), "positives": len(pos), "negatives": len(neg), "x_positives_naming_company": len(x),
        "headline_company_matched_stop": f"{sum(1 for r in x if verdict(r, 'full') == 'STOP' and r['full'].get('company_matched'))}/{len(x)}",
        "stop_any_reason": {c: f"{sum(1 for r in pos if verdict(r, c) == 'STOP')}/{len(pos)}" for c in cols},
        "never_flag_only_stops": f"{sum(1 for r in pos if verdict(r, 'full') == 'STOP' and r['full'].get('never') and not r['full'].get('company_matched'))}/{len(pos)}",
        "evidence_flipped_stops": f"{sum(1 for r in x if verdict(r, 'extract') == 'VERIFY_FIRST' and verdict(r, 'full') == 'STOP')}/{len(x)}",
        "negatives_wrongly_stopped": {c: f"{sum(1 for r in neg if verdict(r, c) == 'STOP')}/{len(neg)}" for c in cols},
        "negatives_distribution_full": {v: sum(1 for r in neg if verdict(r, "full") == v) for v in ("STOP", "VERIFY_FIRST", "NO_RED_FLAGS_FOUND", None)},
        "positives_distribution_full": {v: sum(1 for r in pos if verdict(r, "full") == v) for v in ("STOP", "VERIFY_FIRST", "NO_RED_FLAGS_FOUND", None)},
        "paraphrased_positives": sum(1 for r in pos if r.get("paraphrased")),
        "stop_any_reason_quoted_only": f"{sum(1 for r in pos if not r.get('paraphrased') and verdict(r, 'full') == 'STOP')}/{sum(1 for r in pos if not r.get('paraphrased'))}",
        "lines_shown": len(shown), "lines_proposed": len(proposed), "gate_drop_rate": pct(len(proposed) - len(shown), len(proposed)),
        "cited_line_invariant": "holds" if not broken else f"BROKEN on {len(broken)} line(s)",
        "seconds_full_p50": round(statistics.median(secs), 1) if secs else None,
        "seconds_full_p95": round(secs[min(len(secs) - 1, int(0.95 * len(secs)))], 1) if secs else None,
        "bill": {"tf_tokens": tokens, "tavily_credits": credits},
        "retried_rows": sum(1 for r in recs if any(len((r.get(c) or {}).get("attempts", [])) > 1 for c in ("extract", "full"))),
    }
    var_path = path.with_name(path.stem + "-variance.jsonl")
    if var_path.exists():
        v = [json.loads(l) for l in var_path.read_text().splitlines() if l.strip()]
        summary["variance"] = f"{sum(1 for e in v if e['verdict'] == e['first'])}/{len(v)} reruns agree with the first run"
    out = path.with_name(path.stem + "-summary.json")
    out.write_text(json.dumps(summary, indent=1) + "\n")
    print(json.dumps(summary, indent=1))
    if broken:
        print("CITED-LINE INVARIANT BROKEN", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--set")
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--out")
    ap.add_argument("--n", type=int, default=0)
    ap.add_argument("--variance", type=int, default=0, help="rerun the first N rows twice more (full column)")
    ap.add_argument("--summarise")
    a = ap.parse_args()
    if a.summarise:
        return summarise(Path(a.summarise))
    if not (a.set and a.out):
        ap.print_help()
        return 2
    return bench(a)


if __name__ == "__main__":
    sys.exit(main())
