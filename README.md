<div align="center">
  <img src="docs/assets/icon-animated.svg" alt="Awas Icon" width="144">
  <h1>Awas 🚨</h1>
  <p><em>Paste an overseas job offer. Get an evidence file — every line a URL plus a quote that code checked against the page's text — and a STOP or VERIFY FIRST before anyone boards.</em></p>
  <img src="docs/assets/readme-hero-animated.svg" alt="Illustration with sample text: the quote gate checks a quote against fetched page text, then a verdict stamp" width="100%">

  <br/>

  [![Live app](https://img.shields.io/badge/▶_Live-awas.edycu.dev-1C2333?style=for-the-badge)](https://awas.edycu.dev)
  [![Demo video](https://img.shields.io/badge/▶_Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/to4VOBm_eNM)
  [![Story page](https://img.shields.io/badge/📰_Story-/about-B42318?style=for-the-badge)](https://awas.edycu.dev/about)
  [![Pitch deck](https://img.shields.io/badge/🖥️_Pitch-deck-4B2C8F?style=for-the-badge)](https://awas.edycu.dev/pitch)
  [![Measured Results](https://img.shields.io/badge/📊_Measured-Results-f59e0b?style=for-the-badge)](DEMO.md)
  [![Nebius Feedback](https://img.shields.io/badge/📝_Nebius-Feedback-76B900?style=for-the-badge)](FEEDBACK.md)
  [![Built for Nebius](https://img.shields.io/badge/Nebius-Global_AI_Hackathon-8b5cf6?style=for-the-badge)](https://nebiusglobalaihackathon.devpost.com/)
  [![Devpost submission](https://img.shields.io/badge/Devpost-Submission-003E54?style=for-the-badge&logo=devpost&logoColor=white)](https://devpost.com/software/awas-xejalo)

  <br/>

  ![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat&logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token_Factory-6057F7?style=flat)
  ![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron-76B900?style=flat)
  ![Tavily](https://img.shields.io/badge/Tavily-search_+_extract-0ea5e9?style=flat)
  ![Tests](https://img.shields.io/badge/tests-164_passing-10B981?style=flat)
  [![CI](https://github.com/edycutjong/awas/actions/workflows/ci.yml/badge.svg)](https://github.com/edycutjong/awas/actions/workflows/ci.yml)
  [![CodeQL](https://github.com/edycutjong/awas/actions/workflows/codeql.yml/badge.svg)](https://github.com/edycutjong/awas/actions/workflows/codeql.yml)
  [![Release](https://img.shields.io/github/v/release/edycutjong/awas?style=flat&sort=semver)](https://github.com/edycutjong/awas/releases)
  [![License](https://img.shields.io/badge/License-MIT-yellow)](https://opensource.org/licenses/MIT)

</div>

---

**Read first:** [`DEMO.md`](DEMO.md) (what was measured, and what was not) · [`FEEDBACK.md`](FEEDBACK.md) (feedback on the Nebius docs and API) · [`docs/SOURCES.md`](docs/SOURCES.md) (every rule and statistic, with the page and the verbatim sentence).

*Awas* is Indonesian for "watch out".

## 📸 See it in Action

**No credentials needed:** [`/judge`](https://awas.edycu.dev/judge) replays five recorded real runs — three STOPs on cited rules (one of them an English ad), a fake vacancy that borrowed a real company's name (VERIFY FIRST), a licensed agency's vacancy (NO RED FLAGS FOUND) — each labelled with its recording date ([`bench/samples.json`](bench/samples.json) says where each text comes from). Live checks need no login (60 per hour per connection). Run locally with the commands in [Getting Started](#-getting-started).

**Live:** [awas.edycu.dev](https://awas.edycu.dev) (the app) · [/about](https://awas.edycu.dev/about) (the story page, with the rules and the quote gate running in your browser) · [/pitch](https://awas.edycu.dev/pitch) (the deck).

> **Measured, out of sample** (tranche 2 of a benchmark frozen before it ran, run once on code tagged `code-freeze`, as a Nebius Serverless Job — [`DEMO.md`](DEMO.md)): **0 of 10 licensed agencies' vacancies stopped**; of 25 publicly reported scam-recruitment cases, **9 STOP, 15 VERIFY FIRST, 1 NO RED FLAGS FOUND**. Every one of the 48 evidence lines shown carries a URL and a quote the code found verbatim in the page text Tavily returned. One honest note first: our own day-0 gate on search coverage failed (a relevant item for 8 of 20 known cases), so Awas does not promise "published reports about this company". The verdict rests on rules quoted from official pages; web evidence is context, and only a verified line about the offer's own company can raise a verdict: to STOP when it names the company beside a harm word and no denial (once in the 25 cases); a phone-number match, a generic or all-caps name, or a mention without a harm word can only raise it to VERIFY FIRST.

## 💡 The Problem & Solution

### The Problem

An aunt in a family WhatsApp group is forwarded an ad — "CS Kamboja, Rp 15 jt/bulan, visa turis OK, tiket ditanggung" — and must tell her nephew tonight whether to take it. The rules that would stop him exist — Cambodia is not a placement country, a tourist visa is not a work permit, a fee before a contract is a warning sign — but they are scattered across police, ministry and embassy pages, and nobody in the group can check them all before he decides. (A composite scene, not a single person.)

The scale is official: Indonesia's foreign ministry reports **1,301 cases handled by the embassy in Cambodia in Q1 2025, 85 % of them online scams**, and **more than 12,000 Indonesians affected between 2021 and 2025**. Each statistic is quoted verbatim with its page in [`docs/SOURCES.md`](docs/SOURCES.md). One caveat from that file: the embassy's 1,301 "cases" include Indonesians who ran scams, not only victims, so Awas claims less than the headline: the offers follow a pattern that official pages describe.

### The Solution

> Most of the scam checkers we looked at give a score or a safe/unsafe label ([`docs/COMPARISON.md`](docs/COMPARISON.md)). Awas gives no score, only evidence: every quote has a URL and is checked in code against the page's text, and lines that fail are dropped on screen.

1. **Extract** — Nemotron 3 Ultra on Nebius Token Factory copies typed fields (company, destination, job, visa, fees, promises, phones) out of the pasted ad; code checks every field is literally in the ad.
2. **Rubric** — fixed rules, each quoting an official page ([`src/lib/rule-sources.ts`](src/lib/rule-sources.ts), [`docs/SOURCES.md`](docs/SOURCES.md)): a job in Cambodia or Myanmar (not placement countries, KP2MI), a tourist or visit visa for work, a fee before a contract and a held passport are `NEVER` rules (STOP); the police checklist's fast departure, high pay for light work, costs advanced then deducted, no company named, and any fee are `CAUTION` (VERIFY FIRST). A named Indonesian company is looked up in a dated snapshot of the official licensed-agency (P3MI) list. In all there are 16 rules (4 `NEVER`, 12 `CAUTION`; the list is the `FLAG_REASON` table in [`src/lib/verdict.ts`](src/lib/verdict.ts)), 14 quoting an official page and 2 checking the licence list.
3. **Search** — Tavily looks for published pages naming this exact company or number, and for reporting on job scams to the same destination — context for the family, never an input to a rule flag. A verified line naming the offer's own company can raise the verdict to STOP when it sits beside a harm word and no denial (once in the 25 held-out cases); a phone-number match, a generic or all-caps name, or a mention without a harm word can only raise it to VERIFY FIRST.
4. **Propose** — the model proposes evidence lines `{url, quote, claim}` over the pages Tavily returned in this run.
5. **Quote gate** — code accepts a quote only if it is a normalised verbatim substring of a chunk fetched in this run. A line that fails is dropped, visibly. Anyone can re-check with [`scripts/verify_quotes.py`](scripts/verify_quotes.py).
6. **Verdict by code, not by model** — **STOP**, **VERIFY FIRST**, or **NO RED FLAGS FOUND** (explicitly "not a guarantee"; never "safe"), from the rubric flags, the verified lines and any failed step ([`src/lib/verdict.ts`](src/lib/verdict.ts)).
7. **Family message** — a short Bahasa message built only from verified lines, with a link to the source of each.

## 🏗️ Architecture & Tech Stack

<p align="center"><img src="docs/architecture.png" width="880" alt="Awas architecture: the browser posts a pasted job ad to /api/check on Vercel, which streams eight steps back: rate slot, Nemotron 3 Ultra extracts the fields on Nebius Token Factory, sourced rules fire in code, Tavily searches the web, Nemotron 3 Super proposes quotes, the quote gate keeps only quotes found word for word on a fetched page, code decides STOP, VERIFY FIRST or NO RED FLAGS FOUND, and Nemotron 3 Super writes the family message. Evidence packs go to Nebius Object Storage; a Nebius Serverless AI Job runs the frozen benchmark."></p>

<p align="center"><sub>One check, in the order it runs. The header shows a real recorded STOP case. Step code: <a href="src/lib/pipeline.ts"><code>src/lib/pipeline.ts</code></a>.</sub></p>

<details><summary>The same flow as a Mermaid diagram</summary>

```mermaid
flowchart LR
  A[Pasted ad] --> B[Extract fields<br/>Nemotron / Token Factory]
  B --> C[Rubric rules<br/>sourced]
  B --> D[Tavily search + extract]
  D --> E[Propose quotes<br/>Nemotron]
  E --> F{Quote gate<br/>verbatim in fetched page?}
  F -- no --> X[Line dropped on screen]
  F -- yes --> G[Code verdict<br/>STOP / VERIFY FIRST]
  C --> G
  G --> H[Family message<br/>Nemotron, verified lines only]
  G --> S[(Nebius Object Storage<br/>evidence pack)]
```

</details>

| Layer | Choice |
|---|---|
| App | Next.js 15, TypeScript, Tailwind 4 |
| Models | NVIDIA Nemotron on Nebius Token Factory, routed per call: **Nemotron 3 Ultra** (`nvidia/Nemotron-3-Ultra-550b-a55b`) extracts the fields (84.8 % field accuracy on 25 Indonesian texts — 20 reporters' descriptions of scam offers and 5 licensed vacancies — vs Super 70.7 % and Lightning 59.6 %, against labels drafted by our build agent, not yet reviewed by a human: [`docs/proof/stage-t.json`](docs/proof/stage-t.json)); **Nemotron 3 Super** (`nvidia/nemotron-3-super-120b-a12b`) proposes evidence lines and writes the family message |
| Retrieval | Tavily `/search` and `/extract` |
| State | Nebius Object Storage (S3 API, SigV4): evidence packs (saved four times: after the rules, after the web search, after the quote gate, and when the check ends), per-IP rate slots (conditional create); a 75-day expiry rule on `cases/` (and 1 day on `rate/`), read back from the bucket on 2026-10-18: [`docs/proof/bucket-lifecycle-2026-10-18.json`](docs/proof/bucket-lifecycle-2026-10-18.json) |
| Nebius libraries | `src/lib/nebius/` (SigV4, Object Storage, service-account auth, Serverless Jobs), copied from the same author's earlier project, [faultline](https://github.com/edycutjong/faultline) |

## 🏆 Nebius Token Factory + NVIDIA Nemotron + Tavily Integration

| # | Sponsor method | What it does in the flow | Code |
|---|---|---|---|
| 1 | Nebius Token Factory `POST /v1/chat/completions`, Nemotron | up to three calls per case: extract fields; propose evidence lines; write the family message | [`tf.ts`](src/lib/tf.ts), [`extract.ts`](src/lib/extract.ts), [`propose.ts`](src/lib/propose.ts), [`message.ts`](src/lib/message.ts) |
| 2 | Tavily `POST /search` | exact-phrase search for the company and phone, a destination search for context, page text for the gate | [`tavily.ts`](src/lib/tavily.ts) |
| 3 | Tavily `POST /extract` | relevant passages from official advisory pages | [`tavily.ts`](src/lib/tavily.ts) |
| 4 | Nebius Object Storage `PutObject` / `GetObject`; conditional `PutObject` for rate slots; presigned URLs | evidence packs, per-IP rate slots, recorded samples, the bench job's results | [`storage.ts`](src/lib/nebius/storage.ts), [`store.ts`](src/lib/store.ts) |
| 5 | Nebius Serverless Jobs `POST /ai/v1/jobs` | runs the frozen benchmark on Nebius compute (uk-south1, `cpu-d3`): tranche 2 ran as job `aijob-e03nhcfcwc4vnee33m` ([`bench/results-t2-job.json`](bench/results-t2-job.json)); the job holds no Nebius or model-provider credential — only the app's bench secret and two presigned upload URLs | [`jobs.ts`](src/lib/nebius/jobs.ts), [`dispatch/route.ts`](src/app/api/bench/dispatch/route.ts) |

**Honest count: 5 distinct methods from 2 vendors**, with NVIDIA as the model family (Nemotron 3 Ultra and Super).

The one extension no sponsor ships is the **quote gate**: two generic APIs become an evidence standard a reader can re-check. The model reads the ad and proposes what to quote; code builds the searches, checks every quote and decides what is shown.

## 📊 Engineering Rigor

| Metric | Value |
|---|---|
| Unit tests | **249 passing** (`npm test`, 21 files) |
| Browser tests | **56 passing** (`npm run e2e`: 28 checks × phone and desktop projects; credential-free paths only: home, `/judge`, `/integrations`, `/about`, `/pitch`, guards, the in-page quote gate and rules, no horizontal scroll at 375/768/1440 px) |
| Benchmark protocol | written before any row was collected: [`bench/PROTOCOL.md`](bench/PROTOCOL.md), with four dated amendments, each committed before the runs it affects |
| Stage-T scoring rules | pre-registered before labels or model runs: [`bench/STAGE-T.md`](bench/STAGE-T.md) |
| Reported cases (tranche 2, 25, out of sample) | **9 STOP · 15 VERIFY FIRST · 1 NO RED FLAGS FOUND** — 8 STOPs on cited rules; 1 on another outlet's report of the same case naming the company (x = 1: only one report names its company, so this is a single case, not a rate) |
| Licensed agencies' vacancies wrongly stopped | **0 / 10** (NO RED FLAGS FOUND 9, VERIFY FIRST 1) |
| Ablation, STOPs on the 25 cases | rules only 8 · rules + Nemotron extraction 8 · code sentence-picker 8 · full Awas 9. The verdict is decided in code on purpose, so that a model's wording alone cannot stamp STOP (its extracted fields can still raise a rule hit — limit 7 below); Nemotron's measured effect on the count is the one evidence-flipped STOP (8 → 9). What it supplies besides: the typed fields (the company name feeds the no-company rule, the licence-list lookup and the gate's company match), the 48 evidence lines with their quotes, and the Bahasa family message |
| Evidence lines shown | 48, each a URL plus a quote found verbatim in code; 6 of 54 proposed dropped (11 %) |
| Same verdict on a rerun | 19 / 20 on the pre-registered rerun (10 licensed vacancies); 20 / 20 on 10 reported cases (3 STOP, 7 VERIFY FIRST, each run twice more), a rerun added afterwards |
| Seconds to verdict, p50 / p95 | **13.7 s / 31.7 s** |
| Cost of a full check | median **$0.0078** in Token Factory tokens, 1–3 Tavily credits in bench mode (a live check with two phone numbers can use up to 5) |

Every row comes from [`bench/results-t2-summary.json`](bench/results-t2-summary.json) and [`DEMO.md`](DEMO.md); tranche 1 (development-visible) and the dev-set results are there too.

### Honest limits (11)

1. **Our day-0 search-coverage gate failed** (8 of 20 known cases had a relevant item; we had set 12 in our own plan before the run, a threshold that first appears in this repository's history afterwards). The web evidence is therefore context; the verdict rests on the cited rules.
2. **The benchmark's reported cases are reporters' descriptions of offers, not the ads.** Real ads carry more red-flag wording; and "no company named" fires on most descriptions partly because reports rarely name the company.
3. **Indonesian is not a listed language** for the Nemotron models used (per their model cards); the 25-text extraction accuracy above (84.8 %) is measured against labels drafted by an agent and not yet reviewed by a human.
4. **The phone path is unbenchmarked.** A phone number with no company name returns VERIFY FIRST, not a verdict.
5. **Tavily's `end_date` also counts "last updated"**, so a "published before" test can leak.
6. **The licensed-ad set is plainer than social-media ads** (official vacancy-board listings), so reassurance wording is under-sampled.
7. **The model can raise a rule the raw text would not.** Extracted fields feed 14 of the 16 rules (all but the passport and visit-visa-holder rules). For the tourist-visa and fee-before-contract NEVER rules the negation check reads only the text before the span the model copied, and for the not-a-placement-country rule only inside that span, so a negator on the other side of the boundary is never seen: a model that copies "Work visa provided (not a tourist visa)" as the visa field can raise a NEVER flag the raw-text path suppresses. Seen once in tranche 1 (t1-p14: the copied span "bukan izin kerja hanya wisata" raised the tourist-visa flag; correct there: the reported offer was tourism-only). No false STOP on a licensed ad (0 of 20). The same fields can also switch the no-company rule off.
8. **A denial outside a fixed phrase list can still produce a company-matched STOP.** The quote gate keeps a verified line naming the company but downgrades it from STOP to VERIFY FIRST when a guard term ("tidak terlibat", "membantah", "mencatut", "akun palsu" …) appears anywhere in the quote or "bukan" appears up to five words before the name; "tidak pernah terlibat kasus TPPO", "PT X bukan pelaku …" and "memulangkan korban TPPO" match no guard. The P3MI lookup is shown but does not override a matched report, so a listed agency named beside a harm word on a fetched page is still stopped. It needs a search result that names the company.
9. **The company match checks the word after the name for a capitalised continuation, not the word before it.** An extracted "Sinar Langgeng" can match a page about "PT Cahaya Sinar Langgeng".
10. **The passport rule is wording-based.** "Workers keep their passports at all times" and "paspor diambil di kantor imigrasi" match it, because only a negation or "own/sendiri" exempts a phrase. Benign wording like this on a licensed ad would be stopped; none of the 25 licensed benchmark ads mentions a passport.
11. **The Tavily free tier is a shared budget and the 900-credit alarm only raises a flag.** A live check with two phone numbers can use up to 5 credits (bench mode 1–3); at the 60-per-hour limit one client could drain the month, after which checks return VERIFY FIRST with "step not completed" (or STOP if a cited rule fired). The English gloss is checked for dropped hedge words, not for dropped negations, and the family message is not scanned for the word "safe"; the Indonesian quote itself is always the page's own text.

**Fixed after the freeze (verdict-neutral, proof: [`docs/proof/p0-3-verdict-neutral-2026-10-18.json`](docs/proof/p0-3-verdict-neutral-2026-10-18.json)):** phone digits are now masked in every flag excerpt (`flags[].span`), in the live stream and in the stored case, with the same last-4 format as the stored ad text. The masking runs after the rubric and the verdict, and re-scoring the recorded tranche-2 run offline gives the same verdict for all 105 case-columns (35 cases, 3 columns). No other `src/lib` behaviour changed; limits 7–10 stay open as disclosed.

Two outlets (antaranews.com, kompas.com) were removed from the benchmark before any model call because their terms prohibit AI use; see Amendment 2 in [`bench/PROTOCOL.md`](bench/PROTOCOL.md).

## 🚀 Getting Started

### Prerequisites

Node 20+, a Nebius Token Factory key, and a Tavily key (Tavily's keyless mode, header `X-Tavily-Access-Mode: keyless`, returned HTTP 200 for one `/search` call: [`docs/proof/tavily-keyless-2026-10-17.json`](docs/proof/tavily-keyless-2026-10-17.json)).

### Installation

```bash
npm ci
cp /dev/null .env.local   # then set the Token Factory key and project, Tavily key, and Object Storage credentials
npm run dev               # http://localhost:3000
```

## 🧪 Testing & CI

```bash
npm test          # 249 vitest tests: quote gate, verdict, rubric, registry, masking, SigV4 vectors, clients, store, pipeline, landing lab
npm run typecheck && npm run lint
npm run build && npm run e2e   # 56 Playwright tests, no credentials needed
```

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, `npm audit`, a gitleaks scan of pushed commits (the full history was scanned clean before the repo went public on 2026-10-17), the production build and the browser tests. Dependabot (grouped, monthly) and CodeQL run on the public repository. Details: [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md).

The quote gate is also checkable by hand: `python3 scripts/verify_quotes.py <case.json>`.

## 📁 Project Structure

```
src/lib/        gate.ts · verdict.ts · rubric.ts · registry.ts · pipeline.ts · tavily.ts · tf.ts · mask.ts · store.ts
src/lib/data/   p3mi-2026-10-17.json (the official licensed-agency list, dated)
src/lib/nebius/ SigV4, Object Storage, auth, Serverless Jobs
src/app/        paste screen, /judge, /case/[id], /integrations, /api/*
e2e/            Playwright specs (no credentials)
bench/          PROTOCOL.md · STAGE-T.md (pre-registered) · frozen sets + MANIFEST.json · results-t1/t2 · samples.json
scripts/        bench.py · seed.py · stage_t.py · verify_quotes.py · fragment_check.mjs · live_check.mjs · hover_check.mjs · build-lab.mjs
public/         landing/ (/about) · pitch/ (/pitch) · fonts/ (OFL, self-hosted)
docs/           SOURCES.md · assets/
```

## 🗺️ Roadmap

- [x] Core flow: extract → rubric → Tavily → quote gate → code verdict → family message
- [x] Evidence-file UI, recorded-case replay, `/judge`, `/integrations`
- [x] Benchmark and stage-T protocols written before data
- [x] Frozen benchmark run and the numbers in [`DEMO.md`](DEMO.md) (tranche 2 as a Nebius Serverless Job)
- [x] Recorded sample cases on `/judge`
- [x] Deployed URL, story page (`/about`) and pitch deck (`/pitch`)
- [ ] Demo video

## 📄 License

MIT — see [`LICENSE`](LICENSE).

## 🙏 Acknowledgments

Rules and statistics come from Indonesia's migrant-worker ministry (KP2MI), foreign ministry, national police press office, manpower ministry and the statutes cited in [`docs/SOURCES.md`](docs/SOURCES.md). Shared Nebius client libraries are from the same author's faultline.
