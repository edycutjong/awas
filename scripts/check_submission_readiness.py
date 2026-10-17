#!/usr/bin/env python3
"""Pre-submission gate over the judge-facing text. Stdlib only.

    python3 scripts/check_submission_readiness.py [--text submission.md ...] [--family-confirmed]

Fails on:
  1. unfilled template placeholders `{like_this}` (templates use <source> / <recordedAt> instead);
  2. a missing live URL, repo URL or video URL in the judge-facing files (README.md, DEMO.md and any --text file);
  3. a figure in README.md that appears in none of docs/SOURCES.md, DEMO.md, bench/*summary*.json, docs/proof/*.json;
  4. a first-person family sentence ("my family", "keluarga saya", …) unless --family-confirmed is passed: whether
     the builder's own family receives these ads is unconfirmed, so judge-facing copy says "ads like this circulate on
     WhatsApp" instead.
Exit 0 only when every check passes; each failure is printed with its file and line.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER = re.compile(r"\{[a-z0-9_]+\}")
LIVE = re.compile(r"https://awas-cek\.vercel\.app")
REPO = re.compile(r"https://github\.com/edycutjong/awas")
VIDEO = re.compile(r"https://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)[\w-]{6,}")
FAMILY = re.compile(
    r"\b(?:my|our)\s+(?:own\s+)?(?:family|aunt|auntie|mother|mum|mom|father|nephew|niece|sister|brother|cousin|uncle|relatives?)\b"
    r"|\b(?:keluarga|tante|bibi|ibu|ayah|bapak|keponakan|kakak|adik|sepupu|paman|om)\s+(?:saya|kami|aku|ku)\b",
    re.IGNORECASE,
)
# Figures worth sourcing: numbers with a thousands separator or ≥ 3 digits, and percentages.
FIGURE = re.compile(r"(?<![\w./#-])(\d{1,3}(?:[.,]\d{3})+|\d{3,}|\d+(?:[.,]\d+)?\s?%)(?![\w/])")
CODE = re.compile(r"`[^`]*`|```.*?```", re.S)
LINK_TARGET = re.compile(r"\]\([^)]*\)|https?://\S+")


def lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines() if path.exists() else []


def corpus() -> str:
    parts = [(ROOT / "docs" / "SOURCES.md"), (ROOT / "DEMO.md")]
    parts += sorted((ROOT / "bench").glob("*summary*.json")) + sorted((ROOT / "docs" / "proof").glob("*.json"))
    return "\n".join(p.read_text(encoding="utf-8") for p in parts if p.exists())


def norm_figure(s: str) -> list[str]:
    s = s.replace(" ", "")
    bare = s.rstrip("%")
    return list({s, bare, bare.replace(",", "."), bare.replace(".", ","), bare.replace(",", "").replace(".", "")})


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", nargs="*", default=[], help="extra judge-facing files (e.g. the Devpost draft)")
    ap.add_argument("--family-confirmed", action="store_true")
    a = ap.parse_args()

    files = [ROOT / "README.md", ROOT / "DEMO.md", ROOT / "FEEDBACK.md"] + [Path(t) for t in a.text]
    problems: list[str] = []

    for f in files:
        for n, line in enumerate(lines(f), 1):
            if PLACEHOLDER.search(CODE.sub("", line)):
                problems.append(f"{f.name}:{n}: unfilled placeholder {PLACEHOLDER.search(CODE.sub('', line)).group(0)}")
            if not a.family_confirmed and FAMILY.search(line):
                problems.append(f"{f.name}:{n}: first-person family sentence while HUMAN-CONFIRM is unresolved: {FAMILY.search(line).group(0)!r}")

    judge_text = "\n".join("\n".join(lines(f)) for f in [ROOT / "README.md", ROOT / "DEMO.md"] + [Path(t) for t in a.text])
    for name, rx in (("live URL", LIVE), ("repo URL", REPO), ("video URL", VIDEO)):
        if not rx.search(judge_text):
            problems.append(f"missing {name} in README.md / DEMO.md{' / ' + ', '.join(a.text) if a.text else ''}")

    sourced = corpus()
    for n, line in enumerate(lines(ROOT / "README.md"), 1):
        text = LINK_TARGET.sub("", CODE.sub("", line))
        for m in FIGURE.finditer(text):
            fig = m.group(1)
            if re.fullmatch(r"20\d\d", fig):  # a year
                continue
            if not any(v and v in sourced for v in norm_figure(fig)):
                problems.append(f"README.md:{n}: figure {fig!r} is in none of docs/SOURCES.md, DEMO.md, bench summaries, docs/proof")

    for p in problems:
        print("FAIL", p)
    print(f"check_submission_readiness: {'OK' if not problems else f'{len(problems)} problem(s)'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
