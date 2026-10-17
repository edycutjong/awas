# Feedback — Nebius Token Factory, Nebius AI Cloud and NVIDIA Nemotron

From building Awas: three Nemotron models on Token Factory, Object Storage and a Serverless Job, in Indonesian.
Each measured item points at a recorded call in `docs/proof/` or `bench/`; the longer friction log is
`docs/DX-REPORT.md`.

## Token Factory

1. **The structured-output guide's own example is refused.** `response_format: {"type": "json_schema",
   "json_schema": <schema>}`, as the guide shows it, returns **HTTP 422** — `"loc": ["body", "response_format",
   "json_schema", "name"], "msg": "Field required"` — on Super and Lightning (`docs/proof/spike-2026-10-15.json`). The
   API reference's `{name, schema, strict}` form works on Super, Lightning and Ultra, while the same reference says
   only `json_object` or `text` is supported. One sentence and one corrected example in the guide would have saved us
   a day-0 spike.
2. **`low_effort` reasoning behaves differently per model, and the difference is invisible until it fails.** Same
   setting (`chat_template_kwargs {enable_thinking: true, low_effort: true}`): Super answered with 6 reasoning tokens
   in 1.3 s; Ultra with about 1,000; Lightning reasoned past a 4,096-token budget and returned **no answer** on 2 of 2
   rows, about 100 s each (`docs/proof/stage-t.json`). A per-model note on the knobs — and a `finish_reason` that says
   the budget ran out while reasoning — would let builders pick settings without measuring them.
3. **Nemotron 3 Ultra is live but undocumented.** `GET /v1/models` lists `nvidia/Nemotron-3-Ultra-550b-a55b`; the
   docs we could read name only the retired `Llama-3_1-Nemotron-Ultra-253B-v1`. We got prices only by
   adding `?verbose=true`. A model page with prices and supported languages would help.
4. **Indonesian is on none of the model cards we could read — please publish multilingual results.** We measured it ourselves on 25
   Indonesian texts (20 reporters' descriptions of scam job offers, 5 licensed vacancies), 6 fields (labels drafted by
   our build agent, not yet reviewed by a human): Ultra 84.8 %, Super
   70.7 %, Lightning 59.6 % with reasoning off (`docs/proof/stage-t.json`). Ultra now does Awas's extraction. Published
   Bahasa Indonesia numbers would tell builders in Southeast Asia which model to start with.
5. **Image input would change this product.** Awas asks a family to copy the text out of an image ad with the phone's
   copy-text feature. `nvidia/Nemotron-3.5-Super-VL` appeared on `/v1/models` during the hackathon
   (`docs/proof/models-2026-10-17.json`); a short guide to image input on Token Factory would let Awas read the
   screenshot itself.

## Nebius AI Cloud

6. **Creating a Serverless Job over REST worked** — `POST /ai/v1/jobs` (an Operation with
   `resourceId`), injected files (≤ 64 KiB fits a small script and a benchmark file), environment variables for
   presigned result URLs. Two notes: about 4 minutes of provisioning before the container starts (the one-row smoke job
   then ran 20 seconds; the tranche-2 job — 35 rows in four columns, plus 20 reruns — 20 minutes:
   `docs/proof/serverless-job-smoke-2026-10-17.json`, `bench/results-t2-job.json`), and the container's stdout is
   readable with `nebius ai job logs` (we did not keep a copy of it, and it no longer returned lines when we re-read it
   later), but we found no REST endpoint for it, so the job writes its own results to Object Storage.
7. **Object Storage conditional writes are a quiet superpower.** A second `PUT` with `If-None-Match: "*"` returns
   **412** (`docs/proof/spike-2026-10-15.json`); Awas builds its per-connection rate limit on it, with no database. It
   deserves a prominent example in the S3-compatibility docs.
