# Stage T — extraction accuracy (rules written before any label or model run)

Stage T asks one question before anything is built on top of it: **can Nemotron read these ads?** Indonesian is not
a listed language on the Super, Lightning or Ultra model cards, so this is measured, not assumed.

## Rows and labels

- Rows: the 25 dev rows (`dev.jsonl`: 20 positives' `ad_text_as_reported` + 5 negatives' `ad_text`). Dev only.
- Labels: `stage-t-labels.jsonl`, six fields per row, every value copied exactly from that row's text:
  - `company` — the employer or recruiting company as written, legal form included; `null` if none is named.
  - `destination` — where the work is, as written (the country if both country and city appear); `null` if absent.
  - `job` — the position offered, as written, shortest phrase that names it; `null` if absent.
  - `visa` — the words about the visa, as written; `null` if absent.
  - `fees` — every amount or fee the applicant is asked to pay, one item each, as written; `[]` if none.
  - `promises` — every benefit promised (pay, free ticket, housing, "no experience needed", ...), one item each; `[]`.
- Labels are hashed into `MANIFEST.json` and committed **before** any model sees a dev row. Labels drafted by an agent
  carry `labeller: "agent (DRAFT-UNREVIEWED)"`, and every stage-T number is reported "vs agent labels, unreviewed"
  until a human has reviewed them.

## Scoring (`scripts/stage_t.py`)

The model's values go through the app's own extraction code (`POST /api/check`, bench mode, `stage: "extract"`), so a
value that is not literally in the ad is already dropped. Both sides are normalised as the quote gate does (NFKC,
lowercase, ASCII quotes, one space; "PT." = "PT").

- **company**: correct iff normalised prediction = normalised label.
- **destination, job, visa**: correct iff the token Jaccard of prediction and label ≥ 0.5 (tokens = letter/digit runs).
- **fees, promises**: label items are matched one-to-one to predicted items (greedy, highest Jaccard first, ≥ 0.5);
  each matched label item is correct. List precision = matched / predicted, recall = matched / labelled.
- **Field accuracy** (the gate number) = (correct scalar fields + matched list items) / (non-empty scalar labels +
  labelled list items), over all 25 rows.
- **False-fill rate** = (scalar fields predicted where the label is null + list items predicted where the label list
  is empty) / (null scalar labels + empty label lists). The company false-fill rate is reported first, on its own.
- **Regex baseline (company only)**: the first `PT …` / `CV …` / `… Ltd|Co., Ltd|Group` name in the text, scored like a
  model, so the table shows what a model adds over a pattern.
- Models: `nvidia/nemotron-3-super-120b-a12b` and `nvidia/Nemotron-3_5-Lightning` (and Ultra only if
  `GET /v1/models` lists it). One run each, temperature 1.0 / top_p 0.95 per the model cards.

## Gates (pre-registered in the spec, restated)

- Best model field accuracy **< 80 % → kill** (no project swap is automatic; a human decides).
- Call 1 runs on Lightning only if Lightning's **company** accuracy ≥ Super's − 5 points; otherwise Super.
