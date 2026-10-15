#!/usr/bin/env python3
"""Day-0 spike: prove every sponsor call Awas depends on, once, live — and record what the docs leave open.

    python3 scripts/spike.py --out docs/proof/spike-<date>.json

Token Factory: GET /v1/models, then one extraction on the composite mockup ad (NOT a benchmark row) for every
response_format variant x reasoning knob, on Super and Lightning: did it parse, how many tokens, how many seconds.
Object Storage: a conditional create (If-None-Match: *) twice on the same key — expect 200 then 412.
Tavily: one exact_match search and one extract with `query` (keyed if TAVILY_API_KEY is set, else the documented
keyless mode). Keys are read from the environment and never written; phone digits are masked in the output.

Environment: TOKENFACTORY_API_KEY, NEBIUS_BUCKET, NEBIUS_S3_ACCESS_KEY_ID, NEBIUS_S3_SECRET_ACCESS_KEY,
NEBIUS_REGION (default eu-west1), optional TAVILY_API_KEY.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

TF = "https://api.tokenfactory.nebius.com/v1"
MODELS = ["nvidia/nemotron-3-super-120b-a12b", "nvidia/Nemotron-3_5-Lightning"]
FORMATS = ["json_schema_raw", "json_schema_named", "json_object"]
KNOBS = ["low_effort", "effort_low", "off"]

# The composite ad from the design mockup (assets/ui/mock.html) — illustrative, not a real ad, not a benchmark row.
MOCK_AD = ("Dibutuhkan CS online untuk Kamboja. Gaji Rp 15 jt/bulan, tanpa pengalaman.\n"
           "Visa turis diurus, tiket ditanggung. Biaya admin Rp 3 jt sebelum berangkat.")

SCHEMA = {
    "type": "object",
    "properties": {
        "is_job_offer": {"type": "boolean"}, "company": {"type": ["string", "null"]},
        "destination": {"type": ["string", "null"]}, "job": {"type": ["string", "null"]},
        "visa": {"type": ["string", "null"]}, "fees": {"type": "array", "items": {"type": "string"}},
        "promises": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_job_offer", "company", "destination", "job", "visa", "fees", "promises"],
    "additionalProperties": False,
}
SYSTEM = ("Copy the key details of this job ad exactly as written. Return ONLY a JSON object with keys is_job_offer, "
          "company, destination, job, visa, fees, promises (strings copied from the text, null or [] if absent).")


def http(method: str, url: str, headers: dict, body: bytes | None = None, timeout: int = 120) -> tuple[int, dict, bytes, float]:
    t0 = time.time()
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read(), time.time() - t0
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read(), time.time() - t0
    except Exception as e:  # recorded, not hidden
        return 0, {}, str(e).encode(), time.time() - t0


def mask_phones(s: str) -> str:
    return re.sub(r"(\+?\d[\d\s.-]{6,})(\d{4})", lambda m: re.sub(r"\d", "•", m.group(1)) + m.group(2), s)


def tf_body(model: str, fmt: str, knob: str) -> dict:
    body: dict = {
        "model": model, "max_tokens": 4096, "temperature": 1.0, "top_p": 0.95,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": f"JSON schema: {json.dumps(SCHEMA)}\n\nText:\n<<<\n{MOCK_AD}\n>>>"}],
    }
    if fmt == "json_schema_raw":
        body["response_format"] = {"type": "json_schema", "json_schema": SCHEMA}
    elif fmt == "json_schema_named":
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "job_ad_fields", "schema": SCHEMA, "strict": True}}
    else:
        body["response_format"] = {"type": "json_object"}
    if knob == "low_effort":
        body["chat_template_kwargs"] = {"enable_thinking": True, "low_effort": True}
    elif knob == "off":
        body["chat_template_kwargs"] = {"enable_thinking": False}
    elif knob == "effort_low":
        body["reasoning_effort"] = "low"
    return body


def parse_json(text: str):
    text = re.sub(r"<think>[\s\S]*?</think>", "", text or "").strip()
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b <= a:
        return None
    try:
        return json.loads(text[a:b + 1])
    except json.JSONDecodeError:
        return None


def spike_tf(key: str, models: list[str] = MODELS, formats: list[str] = FORMATS) -> dict:
    out: dict = {"models_endpoint": None, "runs": []}
    st, _, raw, secs = http("GET", f"{TF}/models", {"Authorization": f"Bearer {key}"})
    ids = []
    try:
        ids = sorted(m.get("id") for m in json.loads(raw).get("data", []))
    except Exception:
        pass
    out["models_endpoint"] = {"status": st, "seconds": round(secs, 2), "count": len(ids),
                              "nvidia": [i for i in ids if "nemotron" in i.lower() or i.lower().startswith("nvidia/")]}
    for model in models:
        for fmt in formats:
            for knob in KNOBS:
                body = tf_body(model, fmt, knob)
                st, _, raw, secs = http("POST", f"{TF}/chat/completions",
                                        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                        json.dumps(body).encode())
                rec = {"model": model, "format": fmt, "knob": knob, "status": st, "seconds": round(secs, 2)}
                try:
                    j = json.loads(raw)
                    ch = (j.get("choices") or [{}])[0]
                    content = (ch.get("message") or {}).get("content") or ""
                    usage = j.get("usage") or {}
                    parsed = parse_json(content)
                    rec.update({
                        "request_id": j.get("id"), "finish_reason": ch.get("finish_reason"),
                        "prompt_tokens": usage.get("prompt_tokens"), "completion_tokens": usage.get("completion_tokens"),
                        "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens"),
                        "content_chars": len(content), "parsed": parsed is not None,
                        "schema_keys_ok": parsed is not None and set(SCHEMA["required"]) <= set(parsed),
                        "visa_field": (parsed or {}).get("visa"), "company_field": (parsed or {}).get("company"),
                        "error": None if st == 200 else mask_phones(json.dumps(j)[:300]),
                    })
                except Exception:
                    rec.update({"parsed": False, "error": mask_phones(raw[:300].decode(errors="replace"))})
                out["runs"].append(rec)
                print(f"  TF {model.split('/')[-1]:<34} {fmt:<18} {knob:<11} {st} {rec.get('seconds')}s "
                      f"parsed={rec.get('parsed')} tokens={rec.get('completion_tokens')}", file=sys.stderr)
    return out


# --- SigV4 for one conditional PUT (stdlib) --------------------------------------------------------------------

def sigv4_put(endpoint: str, region: str, bucket: str, key: str, body: bytes, ak: str, sk: str, extra: dict) -> tuple[int, dict, bytes, float]:
    host = endpoint.split("//", 1)[1]
    now = dt.datetime.now(dt.timezone.utc)
    amz, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    payload = hashlib.sha256(body).hexdigest()
    headers = {"host": host, "x-amz-content-sha256": payload, "x-amz-date": amz, **{k.lower(): v for k, v in extra.items()}}
    signed = ";".join(sorted(headers))
    canonical = "\n".join(["PUT", f"/{bucket}/{key}", "", "".join(f"{k}:{headers[k]}\n" for k in sorted(headers)), signed, payload])
    scope = f"{day}/{region}/s3/aws4_request"
    sts = "\n".join(["AWS4-HMAC-SHA256", amz, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    k = hmac.new(f"AWS4{sk}".encode(), day.encode(), hashlib.sha256).digest()
    for part in (region, "s3", "aws4_request"):
        k = hmac.new(k, part.encode(), hashlib.sha256).digest()
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    h = {kk: vv for kk, vv in headers.items() if kk != "host"}
    h["Authorization"] = f"AWS4-HMAC-SHA256 Credential={ak}/{scope}, SignedHeaders={signed}, Signature={sig}"
    return http("PUT", f"{endpoint}/{bucket}/{key}", h, body)


def spike_storage() -> dict:
    bucket, ak, sk = os.environ.get("NEBIUS_BUCKET"), os.environ.get("NEBIUS_S3_ACCESS_KEY_ID"), os.environ.get("NEBIUS_S3_SECRET_ACCESS_KEY")
    if not (bucket and ak and sk):
        return {"skipped": "no bucket credentials in the environment"}
    region = os.environ.get("NEBIUS_REGION", "eu-west1")
    endpoint = f"https://storage.{region}.nebius.cloud"
    key = f"spike/conditional-{int(time.time())}.json"
    res = []
    for attempt in (1, 2):
        st, hdr, raw, secs = sigv4_put(endpoint, region, bucket, key, json.dumps({"attempt": attempt}).encode(), ak, sk, {"If-None-Match": "*"})
        res.append({"attempt": attempt, "status": st, "seconds": round(secs, 2), "etag": hdr.get("ETag") or hdr.get("etag")})
        print(f"  Object Storage conditional PUT #{attempt}: {st}", file=sys.stderr)
    return {"bucket": bucket, "region": region, "key": key, "puts": res,
            "conditional_create_works": res[0]["status"] == 200 and res[1]["status"] == 412}


def spike_tavily() -> dict:
    key = os.environ.get("TAVILY_API_KEY")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    else:
        headers["X-Tavily-Access-Mode"] = "keyless"
    out: dict = {"access": "key" if key else "keyless", "calls": []}
    # A non-benchmark query: the official ministry on the scam-compound pattern, as the extract target.
    search_body = {"query": '"Kementerian Luar Negeri" imbauan tawaran kerja Kamboja', "exact_match": True, "country": "indonesia",
                   "max_results": 3, "include_raw_content": "text", "include_usage": True}
    st, _, raw, secs = http("POST", "https://api.tavily.com/search", headers, json.dumps(search_body).encode(), 60)
    j = json.loads(raw) if st == 200 else {}
    urls = [r.get("url") for r in j.get("results", [])]
    out["calls"].append({"method": "search", "params": search_body, "status": st, "seconds": round(secs, 2),
                         "credits": (j.get("usage") or {}).get("credits"), "request_id": j.get("request_id"), "urls": urls,
                         "raw_content_chars": [len(r.get("raw_content") or "") for r in j.get("results", [])]})
    print(f"  Tavily search: {st} credits={(j.get('usage') or {}).get('credits')} urls={len(urls)}", file=sys.stderr)
    official = [u for u in urls if u and ".go.id" in u][:2] or urls[:1]
    if official:
        ex_body = {"urls": official, "query": "peringatan tawaran kerja luar negeri visa turis", "chunks_per_source": 3, "include_usage": True}
        st, _, raw, secs = http("POST", "https://api.tavily.com/extract", headers, json.dumps(ex_body).encode(), 60)
        j = json.loads(raw) if st == 200 else {}
        res = j.get("results", [])
        out["calls"].append({"method": "extract", "params": ex_body, "status": st, "seconds": round(secs, 2),
                             "credits": (j.get("usage") or {}).get("credits"), "request_id": j.get("request_id"),
                             "chunks": [len((r.get("raw_content") or "").split("[...]")) for r in res],
                             "failed": j.get("failed_results")})
        print(f"  Tavily extract: {st} credits={(j.get('usage') or {}).get('credits')}", file=sys.stderr)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--skip-tf", action="store_true")
    ap.add_argument("--tf-only", action="store_true", help="Token Factory only (a follow-up probe, e.g. a model listed later)")
    ap.add_argument("--models", nargs="*", default=MODELS)
    ap.add_argument("--formats", nargs="*", default=FORMATS)
    a = ap.parse_args()
    report = {"recorded_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ad": "composite mockup ad (not a benchmark row)"}
    tf_key = os.environ.get("TOKENFACTORY_API_KEY")
    report["token_factory"] = spike_tf(tf_key, a.models, a.formats) if tf_key and not a.skip_tf else {"skipped": "no TOKENFACTORY_API_KEY or --skip-tf"}
    if not a.tf_only:
        report["object_storage"] = spike_storage()
        report["tavily"] = spike_tavily()
    with open(a.out, "w") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    print(f"wrote {a.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
