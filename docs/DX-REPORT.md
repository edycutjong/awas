# Developer-experience report

What building Awas on Nebius Token Factory, NVIDIA Nemotron and Tavily was actually like — the friction, measured.
Every measured observation points at a recorded call in `docs/proof/` or `bench/`; statements about the docs cite the doc page. This is the source of the Devpost Feedback field
(`FEEDBACK.md`).

## Token Factory

**1. Structured output: the guide's own example is refused.** The structured-output guide shows `response_format`
as `{"type": "json_schema", "json_schema": <the schema itself>}`. Sent exactly like that, Token Factory answers
**HTTP 422** on Super and Lightning: `"loc": ["body", "response_format", "json_schema", "name"], "msg": "Field required"`
(`docs/proof/spike-2026-10-15.json`, runs 0–2 and 9–11). The API-reference form `{name, schema, strict}` works on Super,
Lightning and Ultra, and so does `json_object` (same file; `spike-ultra-2026-10-15.json`). Meanwhile the API reference
says only `json_object` or `text` is supported. Three statements, one behaviour; Awas sends the named form and falls back
to `json_object` on a 400/422 (`src/lib/tf.ts`).

**2. The reasoning knob behaves differently per model.** With the model card's
`chat_template_kwargs {enable_thinking: true, low_effort: true}`:
- Super answered a short extraction with 6 reasoning tokens in 1.3 s (`spike-2026-10-15.json`, run 3);
- Ultra spent about 1,000 reasoning tokens and answered in about 4 s (`spike-ultra-2026-10-15.json`);
- Lightning reasoned past a 4,096-token budget and returned **no answer** on 2 of 2 dev rows, about 100 s each
  (`docs/proof/stage-t.json`, the Lightning `low_effort` run). With reasoning off it answered every row in about 1.5 s.

So the knob is a per-call setting in Awas (`REASONING_CALL_1/2/3`, `src/lib/settings.ts`), and an empty `content` is an
error, never a line to show (`src/lib/tf.ts`).

**3. Ultra is live but undocumented.** `GET /v1/models` lists `nvidia/Nemotron-3-Ultra-550b-a55b`
(`spike-ultra-2026-10-15.json`, `models_endpoint`), while the Token Factory docs we could read name only the retired
`Llama-3_1-Nemotron-Ultra-253B-v1`. Prices are visible only through `GET /v1/models?verbose=true`.

**4. Indonesian is not on any of the three model cards** (Super, Lightning, Ultra), so we measured it (stage T, 25
dev texts — 20 reporters' descriptions of scam offers and 5 licensed vacancies — six fields, `docs/proof/stage-t.json`; labels drafted by the build agent and **reviewed by a human: 25/25 rows, none changed** (`bench/stage-t-review.json`)):

| Model (reasoning setting) | Field accuracy vs the agent's labels |
|---|---|
| `nvidia/Nemotron-3-Ultra-550b-a55b` (low_effort) | 84.8 % |
| `nvidia/nemotron-3-super-120b-a12b` (low_effort) | 70.7 % |
| `nvidia/Nemotron-3_5-Lightning` (reasoning off) | 59.6 % |
| `nvidia/Nemotron-3_5-Lightning` (low_effort) | no answer on 2/2 rows |
| regex baseline, company field only | 0/6 |

Ultra therefore does call 1 (extraction); Super does calls 2 and 3 (`docs/proof/stage-t.json`, `routing`).

## Tavily

**5. Keyless access works as documented.** `X-Tavily-Access-Mode: keyless` with no key returns real results (HTTP 200,
`usage.credits` 1: `docs/proof/tavily-keyless-2026-10-17.json`). Every Awas receipt records which mode served the call.

**6. Coverage of Indonesian sources depends on the query far more than on the index.** On 20 dev cases, the
pre-registered query (job + destination, `topic: "news"`, `time_range: "year"`, `language: "id"` — `patternQuery` in
`src/lib/pipeline.ts` before commit 3d19b31) surfaced a relevant item for **8/20** (`docs/proof/stage-v.json`, `stage-v-relevance.json`) — the day-0 gate Awas had set itself (≥ 12/20)
failed. A destination-centred query (`topic: "general"`, `country: "indonesia"`, no time range) surfaced one for
**18/20** on the same cases (an agent's reading, like the 8/20) (`docs/proof/dev-tune-2026-10-17.json` — in-sample, the dev set the query was tuned on).
`country` boosts only with `topic: "general"` (Tavily's search reference, `country`), which is easy to miss.

**7. `extract` failed quietly on a social-media URL** (`Failed to fetch url`, 0 credits, `spike-2026-10-15.json`); Awas
leaves social-media domains out of its context search.

**8. `end_date` filters on "publish date or last updated date"**, so a "published before" test can leak; Awas's
V-time column says so (`docs/proof/stage-v-time.json`).

## Nebius Object Storage

**9. Conditional create works:** a second `PUT` with `If-None-Match: "*"` returned **412** (`spike-2026-10-15.json`,
`object_storage`). Awas builds its per-IP rate slots on it, with no database.

## Vercel (hosting, not a sponsor)

**10.** Hobby plan with Fluid compute: the function limit is 300 s. A full live check — three Token Factory calls, the
Tavily searches and the quote gate — took **9.7 s** end to end on the deployed function (2026-10-17).
