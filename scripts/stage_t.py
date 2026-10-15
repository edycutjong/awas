#!/usr/bin/env python3
"""Stage T: does Nemotron read these ads? Scored exactly as bench/STAGE-T.md says (rules written before the run).

    # run the app with the model under test on call 1, then:
    python3 scripts/stage_t.py --base http://localhost:3000 --model nvidia/nemotron-3-super-120b-a12b --out docs/proof/stage-t.json

Each dev row goes through the app's own extraction code (POST /api/check, bench mode, stage "extract"), so a value
that is not literally in the ad is already dropped there. The output file accumulates one entry per model, plus the
company regex baseline. Needs AWAS_BENCH_SECRET (the same value the app was started with).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

SCALARS = ["company", "destination", "job", "visa"]
LISTS = ["fees", "promises"]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "").lower()
    s = re.sub(r"[‘’‚‛′]", "'", s)
    s = re.sub(r"[“”„‟″]", '"', s)
    s = re.sub(r"\b(pt|cv)\.", r"\1", s)
    return re.sub(r"\s+", " ", s).strip(" .,;:")


def tokens(s: str) -> set[str]:
    return set(re.findall(r"[^\W_]+", norm(s)))


def jaccard(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


def correct_scalar(field: str, pred: str | None, label: str | None) -> bool:
    if not pred or not label:
        return False
    return norm(pred) == norm(label) if field == "company" else jaccard(pred, label) >= 0.5


def match_list(pred: list[str], label: list[str]) -> int:
    pairs = sorted(((jaccard(p, l), i, j) for i, p in enumerate(pred) for j, l in enumerate(label)), reverse=True)
    used_p, used_l, n = set(), set(), 0
    for score, i, j in pairs:
        if score < 0.5:
            break
        if i in used_p or j in used_l:
            continue
        used_p.add(i)
        used_l.add(j)
        n += 1
    return n


REGEX_COMPANY = re.compile(r"\b(?:PT|CV)\.?\s+[A-Z0-9][\w&.'-]*(?:\s+[A-Z0-9][\w&.'-]*){0,5}|"
                           r"\b[A-Z][\w&'-]+(?:\s+[A-Z][\w&'-]+){0,4}\s+(?:Co\.?,?\s*Ltd\.?|Ltd\.?|Group|Corporation|Sdn\.?\s*Bhd\.?)")


def regex_company(text: str) -> str | None:
    m = REGEX_COMPANY.search(text)
    return m.group(0).strip(" .,;:") if m else None


def check(base: str, secret: str, ad: str) -> dict:
    req = urllib.request.Request(f"{base}/api/check", method="POST", data=json.dumps({"adText": ad, "lang": "id", "stage": "extract"}).encode(),
                                 headers={"Content-Type": "application/json", "x-awas-bench": secret})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=180) as r:
        body = r.read().decode()
    secs = time.time() - t0
    case_id = None
    for block in body.split("\n\n"):
        # `started` carries the case id too; a stream without `done` (an app bug fixed 2026-10-15) still resolves.
        if block.startswith("event: done") or (block.startswith("event: started") and not case_id):
            case_id = json.loads(block.split("data: ", 1)[1]).get("caseId") or case_id
    if not case_id:
        return {"error": "no case id", "seconds": secs}
    with urllib.request.urlopen(f"{base}/api/case/{case_id}", timeout=30) as r:
        pack = json.loads(r.read())
    return {"pack": pack, "seconds": secs}


def score(rows: list[dict], preds: dict[str, dict]) -> dict:
    correct = total = 0
    fill_false = fill_slots = 0
    company_ok = company_n = company_ff = company_empty = 0
    list_pred = list_match = list_label = 0
    per_field: dict[str, list[int]] = {f: [0, 0] for f in SCALARS + LISTS}
    for row in rows:
        lab, pred = row["labels"], preds.get(row["id"], {})
        for f in SCALARS:
            p, l = pred.get(f), lab.get(f)
            if l:
                total += 1
                per_field[f][1] += 1
                if correct_scalar(f, p, l):
                    correct += 1
                    per_field[f][0] += 1
            else:
                fill_slots += 1
                if p:
                    fill_false += 1
            if f == "company":
                if l:
                    company_n += 1
                    company_ok += int(correct_scalar(f, p, l))
                else:
                    company_empty += 1
                    company_ff += int(bool(p))
        for f in LISTS:
            p, l = pred.get(f) or [], lab.get(f) or []
            m = match_list(p, l)
            list_pred += len(p)
            list_match += m
            list_label += len(l)
            if l:
                total += len(l)
                correct += m
                per_field[f][0] += m
                per_field[f][1] += len(l)
            else:
                fill_slots += 1
                fill_false += int(len(p) > 0)
    pct = lambda a, b: round(100 * a / b, 1) if b else None
    return {
        "field_accuracy_pct": pct(correct, total), "correct": correct, "labelled": total,
        "false_fill_rate_pct": pct(fill_false, fill_slots), "false_fills": fill_false, "empty_label_slots": fill_slots,
        "company_accuracy_pct": pct(company_ok, company_n), "company_labelled": company_n,
        "company_false_fill_rate_pct": pct(company_ff, company_empty), "company_empty_labels": company_empty,
        "list_precision_pct": pct(list_match, list_pred), "list_recall_pct": pct(list_match, list_label),
        "per_field": {f: {"correct": c, "labelled": n, "pct": pct(c, n)} for f, (c, n) in per_field.items()},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--model", required=True, help="the model the app is running on call 1 (recorded, not set)")
    ap.add_argument("--dev", default="bench/dev.jsonl")
    ap.add_argument("--labels", default="bench/stage-t-labels.jsonl")
    ap.add_argument("--out", default="docs/proof/stage-t.json")
    a = ap.parse_args()
    secret = os.environ.get("AWAS_BENCH_SECRET")
    if not secret:
        print("AWAS_BENCH_SECRET is required", file=sys.stderr)
        return 2
    dev = {r["id"]: r for r in (json.loads(l) for l in Path(a.dev).read_text().splitlines() if l.strip())}
    labels = [json.loads(l) for l in Path(a.labels).read_text().splitlines() if l.strip()]
    rows = []
    for lab in labels:
        r = dev[lab["id"]]
        rows.append({"id": lab["id"], "text": r.get("ad_text_as_reported") or r.get("ad_text"), "labels": lab})

    preds: dict[str, dict] = {}
    details = []
    for row in rows:
        res = check(a.base, secret, row["text"])
        ex = (res.get("pack") or {}).get("extraction") or {}
        tf = ((res.get("pack") or {}).get("receipt") or {}).get("tf") or [{}]
        pred = {f: (ex.get(f) or {}).get("text") if ex.get(f) else None for f in SCALARS}
        pred.update({f: [s["text"] for s in ex.get(f) or []] for f in LISTS})
        preds[row["id"]] = pred
        details.append({"id": row["id"], "seconds": round(res["seconds"], 2), "pred": pred, "dropped_fields": ex.get("droppedFields"),
                        "tokens": (tf[0].get("promptTokens") or 0) + (tf[0].get("completionTokens") or 0), "error": res.get("error") or tf[0].get("error")})
        print(f"  {row['id']} {res['seconds']:.1f}s company={pred.get('company')!r}", file=sys.stderr)

    regex_preds = {r["id"]: {"company": regex_company(r["text"])} for r in rows}
    out_path = Path(a.out)
    report = json.loads(out_path.read_text()) if out_path.exists() else {"rules": "bench/STAGE-T.md", "labels": a.labels, "runs": {}}
    report["labeller"] = labels[0].get("labeller")
    report["runs"][a.model] = {"recorded_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "score": score(rows, preds),
                               "seconds_p50": sorted(d["seconds"] for d in details)[len(details) // 2], "rows": details}
    company_rows = [dict(r, labels={"company": r["labels"].get("company")}) for r in rows]
    report["regex_baseline_company"] = score(company_rows, regex_preds)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    s = report["runs"][a.model]["score"]
    print(f"{a.model}: field accuracy {s['field_accuracy_pct']}% ({s['correct']}/{s['labelled']}), company {s['company_accuracy_pct']}%, "
          f"false-fill {s['false_fill_rate_pct']}% — vs {report['labeller']} labels", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
