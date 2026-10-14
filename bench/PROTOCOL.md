# Benchmark collection protocol

Written and committed **before any row was collected** (git history is the timestamp). It fixes where rows come
from, which reports qualify, and how rows are split, so the numbers in `DEMO.md` cannot be produced by choosing
the cases after seeing the results. Hashes (`MANIFEST.json`) prove the rows did not change; this file covers how
they were chosen.

## 1. Sets

| Set | Positives | Negatives | Role |
|---|---|---|---|
| `dev.jsonl` | 20 | 5 | prompt and constant tuning only; never scored; the same 25 texts are the stage-T extraction rows |
| `tranche1.jsonl` | up to 25 | up to 10 | first measured number (tag `bench-t1`), development-visible once read |
| `tranche2.jsonl` | up to 25 | up to 10 | the headline (tag `bench-t2`); run **once**, on code tagged `code-freeze` |

All rows are collected in one pass, hashed into `MANIFEST.json`, and assigned to a set by the seeded shuffle in §5.
If fewer rows qualify, the sets are smaller. Rows are never padded, never edited after hashing, never moved
between sets.

## 2. Positives — publicly reported scam-recruitment cases

**Named listings**, crawled in this order (the order decides which outlet's copy of a case is kept):

1. `https://www.antaranews.com/tag/tppo-kamboja` pages 1–6
2. `https://www.antaranews.com/tag/tppo-myanmar` pages 1–3
3. `https://www.antaranews.com/tag/online-scam` pages 1–3
4. `https://www.kompas.com/tag/tppo-kamboja` pages 1–4
5. `https://www.kompas.com/tag/tppo-myanmar` pages 1–2
6. `https://www.detik.com/tag/tppo-kamboja` pages 1–3
7. `https://www.liputan6.com/tag/tppo-kamboja` pages 1–3
8. `https://www.cnnindonesia.com/tag/tppo-kamboja` page 1 and `https://www.cnnindonesia.com/tag/online-scam` page 1

Every article link on a listing page is taken in page order (`scripts/collect.py listings`); links that are not
articles of that outlet are skipped. **Date range:** published 2022-01-01 to 2026-10-13 inclusive.

**A report qualifies** when all of these hold (otherwise it is logged in `collection-rejects.jsonl` with a reason):

- **Q1 on topic** — it reports Indonesians recruited for work abroad in a case the report calls trafficking
  (TPPO / perdagangan orang), online-scam work (online scam, penipuan daring, scammer), or illegal / non-procedural
  placement on a deceptive offer. Reason if not: `off_topic`.
- **Q2 the offer is stated** — the report states at least two concrete elements of the offer *as made before
  departure*: job or position, pay, destination, visa / ticket / document arrangement, a fee, a requirement, or where
  the ad ran. Reason if not: `no_offer_detail`.
- **Q3 verbatim** — the offer can be taken as one or more verbatim excerpts of the report (sentences or clauses),
  kept in report order and joined by a newline. Only text about the offer is taken; text that only describes what
  happened after arrival, the investigation, or official comment is left out. Where the report quotes the ad itself,
  `paraphrased` is `false`; where the reporter or an official describes the offer, `paraphrased` is `true`.
- **Q4 no private data** — person names in an excerpt are replaced by `[nama]`, phone numbers by `[nomor]`, and the
  replacement count is stored in `redactions`. No row contains phone digits (`seed.py --check`). Victims and
  recruiters are never named.
- **Q5 one row per case** — another outlet's report of a case already collected (same company, or the same victims
  and event: date, origin, destination) is logged as `duplicate_case`; the earlier listing position wins.
- **Q6 in range** — published inside the date range. Reason if not: `out_of_range`.

`company_as_reported` is the recruiting or employing company exactly as the report names it (legal form included),
only when the report names one and never a person. A positive counts toward the headline denominator **x** only if
`company_as_reported` occurs in `ad_text_as_reported` (computed by `seed.py --check`, never typed).

Positive row: `{id, set, kind:"positive", source_url, source_title, published, listing, listing_position,
ad_text_as_reported, paraphrased, company_as_reported?, destination_as_reported?, redactions, sha256}`.

## 3. Negatives — ads by licensed placement companies

**Named listing:** the official SISKOP2MI vacancy board of the Indonesian migrant-worker ministry (KP2MI),
`https://siskop2mi.bp2mi.go.id/lowongan/list`, whose records each carry the recruitment permit (SIP) number of a
licensed placement company (P3MI); records are read in the board's default order through its own JSON loader
(`lowongan/load_sip_record/<offset>`, `urutan=1&berdasarkan=1`).

**A vacancy qualifies** when: N1 its detail page `lowongan/detail/<id>` returns HTTP 200 with a job description;
N2 the sector is not domestic household work (the formal-sector jobs Awas's negatives are meant to measure);
N3 its company is not already in the collection (one ad per company — at least 5 distinct companies);
N4 the destination is not Cambodia, Myanmar or Laos (those would test the advisory flag, not a licensed ad).

`ad_text` is the detail page's own text, verbatim, in page order: position, destination, job description,
qualifications, facilities, pay, and the cost table ("Pembiayaan"); the company's phone, e-mail and street address
are left out. `company` is the P3MI name as the board shows it.

**Same-prefix pairs:** after the positives are collected, at least 2 licensed companies whose names share their
leading tokens with a company named in a positive are looked up by name on the same board (listed as
`listing: "siskop2mi-same-prefix"`). They measure whether Awas's company match stops a licensed firm for a scam
firm's similar name.

Negative row: `{id, set, kind:"negative", source_url, ad_text, company, sip_no, destination, sector, listing,
listing_position, sha256}`. Expected verdict: VERIFY FIRST or NO RED FLAGS FOUND; any STOP is a false stop.

## 4. Samples pool (not scored)

The five `/judge` samples and the demo ad are real reports or ads that are **not** benchmark rows. `seed.py --check`
fails if a sample shares a source URL, a case or a company with any benchmark row.

## 5. Split

1. Every qualifying row gets `sha256` = SHA-256 of its canonical JSON (sorted keys, without `id`, `set`, `sha256`).
2. Rows are ordered by `sha256`, then shuffled with Python's `random.Random(SEED)`, `SEED = 20261014`.
3. Positives: the first 20 go to `dev`, then they alternate `tranche1`, `tranche2` (up to 25 each); negatives: the
   first 5 go to `dev`, then they alternate (up to 10 each). Rows beyond the caps are listed as `unused` in
   `MANIFEST.json` and never run.
4. Dev ∩ tranches = ∅ **by case and by company**: rows are grouped by company before the shuffle, so one company's
   rows always land in the same set.

## 6. Labels (dev set only)

The 25 dev texts carry hand labels for stage T (company, destination, job, visa, fees, promises), written into
`stage-t-labels.jsonl` and hashed into `MANIFEST.json` **before any model sees a dev row**. Labels drafted by the
build agent are marked `labeller: agent (DRAFT-UNREVIEWED)`; every stage-T number says "vs agent labels,
unreviewed" until a human has reviewed them.

## Amendment 1 — more listings (2026-10-15, before any model call)

**Why:** the first pass (listings 1–8) gave 254 article links → 164 on-topic candidates → about 22 qualifying rows.
Most tag-page articles are repatriation, policy or digest pieces, and the same few cases are reported many times.
Twenty-odd positives cannot fill dev (20) plus two tranches. Listing limitations found in pass 1 (no server-rendered
article links): `detik.com` tag pages 2–3, `cnnindonesia.com/tag/tppo-kamboja`, and `liputan6.com` tag pages (their
server-rendered links are site-wide widgets dated today, all outside the date range).

**Added listings**, crawled after listings 1–8, in this order. Links already collected are skipped, so pass-1
positions do not change.

9. `https://www.antaranews.com/tag/tppo` pages 1–30
10. `https://www.kompas.com/tag/tppo` pages 1–15
11. `https://www.antaranews.com/tag/pmi-ilegal` pages 1–8
12. `https://www.kompas.com/tag/tppo-kamboja` pages 5–10

**Q2 pre-screen (added listings only):** a candidate in which none of the offer words occur — dijanjikan,
diiming-imingi, iming-iming, ditawari, ditawarkan, tawaran, menawarkan, lowongan, loker, iklan, gaji, upah, direkrut,
merekrut, perekrut, tergiur, "bekerja sebagai", "kerja di" — is rejected as `no_offer_detail` without being read.
The rules in §2 and the split in §5 are unchanged.

## Amendment 2 — publisher terms (2026-10-15, before any model call)

**Withdrawn.** Every article page of antaranews.com carries the notice *"Dilarang keras mengambil konten, melakukan
crawling atau pengindeksan otomatis untuk AI di situs web ini tanpa izin tertulis dari Kantor Berita ANTARA"*, and its
robots.txt disallows ClaudeBot. The robots.txt of kompas.com states that automated data mining, use for AI / LLM
development and *"creating or providing archived or cached data sets containing our content"* are prohibited without
written permission. A benchmark built by our own crawler from their pages would be exactly that, so listings 1–5 and
9–12 are withdrawn: their 53 qualifying rows are discarded and their cached pages deleted, before any model saw a row.
One pass-1 row survives (detik.com). The live product does not crawl: it shows short, attributed quotes from what the
Tavily search API returns for one user's check (see DEMO.md).

**Source rule from here on.** A listing is used only if, checked on 2026-10-15, its robots.txt allows generic agents,
blocks no AI crawler (GPTBot, ClaudeBot, CCBot, Google-Extended, …) and states no AI / data-mining clause, and one of
its article pages carries no such notice. Checked and **excluded** under this rule: tribunnews.com, tvrinews.com,
metrotvnews.com, beritasatu.com, mediaindonesia.com, tempo.co, bbc.com (each blocks AI crawlers or states anti-AI
terms). Checked and **allowed**: detik.com, cnnindonesia.com, merdeka.com, jpnn.com, suara.com, okezone.com,
idntimes.com, rri.co.id.

**Added listings**, in this order (pass-1 listings 6–8 stay; links already collected are skipped):

13. `https://www.detik.com/search/searchall?siteid=2&sortby=time&query=…` for the queries "tppo kamboja",
    "tppo myanmar", "online scam kamboja", "lowongan kerja luar negeri tppo" — pages 1–8 each
14. `https://www.merdeka.com/tag/tppo` pages 1–10
15. `https://www.jpnn.com/tag/tppo` pages 1–10
16. `https://www.suara.com/tag/tppo` pages 1–8
17. `https://www.okezone.com/tag/tppo` page 1 (later pages are not server-rendered)
18. `https://www.idntimes.com/tag/tppo` pages 1–8
19. `https://www.rri.co.id/tag/tppo` pages 1–10

The Q2 pre-screen of Amendment 1 applies to these listings. Rules §2–§6 are unchanged.
