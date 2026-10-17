# DEMO — what Awas measured, and how to check it

Every number on this page comes from a committed file in this repository (named beside it). Nothing here is an
estimate.

## 0. Try it without any key (30 seconds)

1. Open **https://awas.edycu.dev/judge** — five recorded real runs, each labelled with the date it was recorded
   (`bench/samples.json` says where each text comes from; none is a benchmark row). No login, no key.
2. Open any evidence card's link: it carries a `#:~:text=` fragment, so the browser highlights the quoted sentence on
   the source page. A card says "found on the live page <date>" only when a real browser saw the quote there
   (`scripts/fragment_check.mjs`); otherwise it tells you which words to search for.
3. Paste your own ad at **https://awas.edycu.dev**. No login, no daily cap. A connection gets 60 live checks per
   hour; the judge code in the Devpost testing notes lifts that limit.

## 1. Read this first: what changed on 2026-10-17

- **The day-0 coverage gate failed, and Awas changed its claim.** Before the benchmark's first run we set ourselves a gate (in our own plan; the threshold first appears in this repository's history afterwards):
  Tavily must surface a relevant advisory or news item for at least 12 of 20 known cases. It surfaced one for **8/20**
  (`docs/proof/stage-v.json`, `stage-v-relevance.json`; read by an agent against the definition stored in that file,
  not yet by a human). So Awas no longer promises "published reports about this company". **The verdict comes from
  rules quoted from official pages; the web evidence is context, and every quote shown is checked in code.**
- **Reports almost never name the recruiting company.** Of the benchmark's reported cases whose offer text names a
  company: 1 in the dev set, 0 in tranche 1, 1 in tranche 2 (`scripts/seed.py --check`). A "company-matched STOP"
  headline cannot be measured on that, so the pre-registered fallback applies: lead with the cited rules.
- **New official rules, tuned on the dev set only, before tranche 1 ever ran** (`bench/PROTOCOL.md` Amendment 4,
  `docs/SOURCES.md`): Cambodia and Myanmar are not placement countries (KP2MI) → STOP; the Polri checklist's
  fast-departure, high-pay-for-light-work, advanced-costs and no-company items, and Kemnaker's "never pay to get a
  job" → VERIFY FIRST.

## 2. The benchmark (frozen before it was run)

- **85 publicly reported scam-recruitment cases + 40 licensed-agency vacancies**, collected under
  `bench/PROTOCOL.md` (written before collection, four amendments, each dated and committed before the runs it
  affects). Every row is SHA-256-hashed in `bench/MANIFEST.json`; rows were split by a committed seed (20261014):
  dev 20 + 5, tranche 1 25 + 10, tranche 2 25 + 10; 15 + 15 unused and not run in any result file shipped here. Git tags `bench-t1`, `bench-t2`.
- **Positives** are reporters' or officials' descriptions of the offer (25 of 25 in tranche 1 are paraphrased), from
  outlets whose terms allow automated reading (two large outlets were withdrawn on their terms, Amendment 2).
  **Negatives** are vacancies by licensed placement companies on the ministry's own SISKOP2MI board. A STOP on a
  negative is a false stop.
- Tuning happens on the dev set only. Tranche 1 is development-visible once read. **Tranche 2 runs once, on code
  tagged `code-freeze`, and carries the headline.**

## 3. Tranche 1 — development-visible (run once, 2026-10-17, on commit 51eefe4)

`bench/results-t1.jsonl` (raw rows with the full evidence packs) · `bench/results-t1-summary.json`

**Licensed ads (10):** **0/10 stopped** in every column. Full verdicts: NO RED FLAGS FOUND 9 · VERIFY FIRST 1 · STOP 0.

**Reported cases (25), four ablation columns through the app's own code (bench mode):**

| Column | STOP | VERIFY FIRST | NO RED FLAGS FOUND | no verdict |
|---|---|---|---|---|
| rubric only (rules on the raw text, no model, no search) | 8 | 16 | 1 | 0 |
| rubric + Nemotron extraction (no search) | 9 | 15 | 1 | 0 |
| full Awas with the evidence proposal replaced by a code sentence-picker | 9 | 13 | 2 | 1 |
| **full Awas** | **9** | **13** | **2** | **1** |

- Every STOP came from a cited rule (9/25); none from a company-matched report (x = 0).
- Rules that fired on the 25 cases (full column): no company named 18 (the only flag on 5 — reports rarely name the
  company, so this rule is partly an artefact of descriptions), advisory destination 9, not a placement country 7,
  tourist visa 3, high pay for light work 3, personal number 2, fee asked 2, passport held 1.
- **Evidence shown:** 42 lines, every one a URL plus a quote the gate found verbatim in the text Tavily returned
  (cited-line invariant asserted by `scripts/bench.py`: holds); 8 of 50 proposed lines dropped (16 %).
  Re-checked afterwards by plain GET with no Awas code (`scripts/verify_quotes.py --bench`,
  `docs/proof/verify-quotes-t1-2026-10-17.txt`): 27 present; 14 not checkable by a script (the site refused it — 403
  or 404 to a repeated fetch — or the page is JavaScript or a PDF; a browser still shows them); 1 "changed since
  fetch", a company-directory table row that Tavily's text writes with ";" separators while the page's HTML has none.
- **Seconds to verdict** (full column, the app's own receipts; run with `--base https://awas.edycu.dev`, so
  every case id in the file opens at `https://awas.edycu.dev/case/<id>`): p50 **10.0 s**, p95 **15.8 s**.
- **Bill:** 235,206 Token Factory tokens and 52 Tavily credits for the full column (0–3 credits a check, mostly 1–2).

**What tranche 1 made visible** (fixed before code-freeze; only tranche 2 measures the fixes): one case ended with no
verdict because the model read the text as "not a job offer" and that switched off a raw-text rule — rules now read
only the raw text; one case ended NO RED FLAGS FOUND because the model returned "Lembaga Pelatihan Kerja (LPK)" as
the company — a kind of recruiter is no longer counted as a name. One more NO RED FLAGS FOUND (domestic work in Qatar)
has no rule: Indonesia's 2015 moratorium on placing domestic workers with private households in Middle-East countries
(Kepmenaker 260/2015) is not encoded — its current scope was not verified (a lifting for Saudi Arabia was announced as
planned in 2025), so it stays a gap rather than a guess.

## 4. Tranche 2 — the headline (out-of-sample: run once, 2026-10-17, on code tagged `code-freeze`)

`bench/results-t2.jsonl` · `bench/results-t2-summary.json` · `bench/results-t2-variance.jsonl` · `bench/results-t2-job.json`

**It ran as a Nebius Serverless Job.** `POST /api/bench/dispatch` checked `bench/tranche2.jsonl` against
`bench/MANIFEST.json` (sha256 `1e333cdf…`) before creating job `aijob-e03nhcfcwc4vnee33m` in uk-south1 (`cpu-d3`,
`python:3.11`). The job ran the committed `scripts/bench.py` (sha256 `35614ce4…`, the file at `code-freeze`) against
the production app in bench mode and wrote its rows through presigned Object Storage URLs. It held no Nebius or
model-provider credential — only the app's bench secret and the two presigned upload URLs.

**Licensed ads (10): 0/10 stopped** in every column. Full verdicts: NO RED FLAGS FOUND 9 · VERIFY FIRST 1 (a page
mentioned a similar name) · STOP 0.

**Reported cases (25):**

| Column | STOP | VERIFY FIRST | NO RED FLAGS FOUND |
|---|---|---|---|
| rubric only (rules on the raw text, no model, no search) | 8 | 16 | 1 |
| rubric + Nemotron extraction (no search) | 8 | 16 | 1 |
| full Awas with the evidence proposal replaced by a code sentence-picker | 8 | 16 | 1 |
| **full Awas** | **9** | **15** | **1** |

- **8 STOPs come from cited rules alone** (8/25): not a placement country, tourist visa.
- **The 9th is a company-matched STOP — 1 of 1.** Only one of the 25 reports names the company in its description of
  the offer (x = 1). Its own article (merdeka.com) was excluded from every search; Tavily's exact-match search found
  **another outlet's report of the same case** (rri.co.id), whose sentence names the company next to "bisnis TPPO";
  the gate found that sentence verbatim. Rules plus extraction alone said VERIFY FIRST, so the evidence decided this
  one (an evidence-flipped STOP, 1/1). With x = 1 this shows the mechanism working once; it is not a rate.
- **The one NO RED FLAGS FOUND:** the model returned "rumah sakit Suriah" (a hospital in Syria) as the company, so the
  no-company rule did not fire. The filter added after tranche 1 drops kinds of recruiter ("LPK", "agen"), not
  descriptions of an employer. Reported as it fell; the code is frozen.
- Rules that fired (full column): no company named 19 (the only flag on 4), fee asked 8, not a placement country 6,
  high pay for light work 3, advisory destination 3, personal number 2, fast departure 2, tourist visa 2, advanced
  costs 1, not on the P3MI list 1.
- **Evidence shown:** 48 lines, every one a URL plus a quote the gate found verbatim (cited-line invariant: holds);
  6 of 54 proposed lines dropped (11 %); 44 of the 48 carry an English gloss, 1 is marked "translation unavailable"
  because the translation lost a hedge word. Re-checked by plain GET (`docs/proof/verify-quotes-t2-2026-10-17.txt`):
  33 present, 14 not checkable by a script, 1 "changed since fetch" — again a directory table row written with ";".
- **Run to run:** the pre-registered rerun took the first 10 rows of the file, which are the licensed vacancies:
  **19/20** reruns gave the first run's verdict (t2-n05 moved from VERIFY FIRST to NO RED FLAGS FOUND once;
  `bench/results-t2-variance.jsonl`). Because that measured no reported case, 10 reported cases were then rerun twice
  more on the same frozen logic (`bench/results-t2-variance-positives.jsonl`, added afterwards; the headline above is
  the first run): **20/20** reruns gave the first run's verdict (3 STOP cases and 7 VERIFY FIRST cases, each run
  twice more).
- **Seconds to verdict** (the app's own receipts, full column): p50 **13.7 s**, p95 **31.7 s**.
- **Bill:** 269,623 Token Factory tokens and 51 Tavily credits for the full column (1–3 credits a check). At the
  prices `GET /v1/models` returns (`docs/proof/models-2026-10-17.json`), the median full check costs **$0.0078** in
  Token Factory tokens.

Pooled with tranche 1 (mixed code versions — an appendix, not a headline): licensed ads 0/20 stopped; reported cases
18 STOP, 28 VERIFY FIRST, 3 NO RED FLAGS FOUND, 1 no verdict, of 50.

## 5. Day-0 stages (dev set, 2026-10-15)

| Stage | Result | File |
|---|---|---|
| T — can Nemotron read the ads? (25 dev texts — 20 reporters' descriptions, 5 licensed vacancies — 6 fields, **vs labels drafted by the build agent, not yet reviewed by a human**) | Ultra 84.8 % · Super 70.7 % · Lightning 59.6 % (reasoning off; no answer with low_effort) · regex baseline 0/6 on the company field → gate (≥ 80 %) passed; Ultra does call 1 | `docs/proof/stage-t.json` |
| R — rules alone on the 20 dev positives (before Amendment 4) | 1 STOP · 8 VERIFY FIRST · 11 NO RED FLAGS FOUND | `docs/proof/stage-r.json` |
| V — does Tavily surface a relevant item? | 8/20 → **gate failed** (≥ 12/20) | `docs/proof/stage-v.json`, `stage-v-relevance.json` |
| V-time — published before the case? | inconclusive: 1 dev positive names a company (< 8) | `docs/proof/stage-v-time.json` |
| EMBED | not run — optional; no embedding endpoint was deployed | — |

**Dev set after Amendment 4 (in-sample — the rules were tuned on these rows; never a benchmark number):** reported
cases, full pipeline, 3 STOP · 17 VERIFY FIRST · 0 NO RED FLAGS FOUND (before, full pipeline in stage V: 1 · 9 · 10 —
stage R above is the rules-only column); licensed ads 0 stopped in any column; the
destination-centred context search found a relevant item for 18/20 (before: 8/20; both are an agent's reading, not yet
a human's). `docs/proof/dev-tune-2026-10-17.json`.

## 6. Bench mode differs from live use in exactly four ways

1. `exclude`: the row's own source domain, and results whose title shares ≥ 60 % of its words with the source title, are
   removed from every Tavily result — a case cannot be "found" by its own article.
2. A secret header skips the per-IP limit.
3. `stage` (`rubric` / `extract` / `full`) produces the ablation columns through the same TypeScript code.
4. An optional `endDate` (the V-time column).

The phone-number search never runs in bench mode: benchmark rows carry no phone numbers, so that path is live-only and
unmeasured.

## 7. Reproduce

```bash
git clone https://github.com/edycutjong/awas && cd awas && npm ci
python3 scripts/seed.py --check                                  # schema, hashes, no phone digits, dev ∩ tranches = ∅
python3 scripts/verify_quotes.py --bench bench/results-t1.jsonl  # every shown quote, re-fetched, no key, no Awas code
# Re-run five rows with your own keys (no bucket env vars → packs go to ./data/):
AWAS_BENCH_SECRET=pick-one TOKENFACTORY_API_KEY=… TAVILY_API_KEY=… MODEL_CALL_1=nvidia/Nemotron-3-Ultra-550b-a55b npm run dev
AWAS_BENCH_SECRET=pick-one python3 scripts/bench.py --set bench/tranche1.jsonl --base http://localhost:3000 --out /tmp/r.jsonl --n 5
```

## 8. Honest limits

- Positives describe offers; they are not the ads. Real ads carry more red-flag wording than reporters keep, so the
  rules' recall on real ads is untested here; the "no company named" rule is partly an artefact of descriptions.
- Stage-T accuracy is measured against labels drafted by the build agent and not yet reviewed by a human.
- Stage V's relevance count is an agent's reading, not a human's.
- The phone-number search is unbenchmarked (live use only).
- Tavily's `end_date` also counts "last updated", so a "published before" test can leak.
- Indonesian is not a listed language on the Super, Lightning or Ultra model cards; stage T is the evidence we have.
