/**
 * Token Factory and Tavily clients against HTTP fixtures shaped like the documented responses.
 * Client behaviour only — the demo path never uses fixtures.
 */
import { describe, expect, it } from "vitest";
import { buildBody, chat } from "@/lib/tf";
import { exactQuery, extract, search } from "@/lib/tavily";
import type { TavilyConfig, TokenFactoryConfig } from "@/lib/nebius/config";

const tf: TokenFactoryConfig = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "m1", propose: "m2", message: "m3" } };

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
function fakeFetch(replies: Reply[], seen: { url: string; init: RequestInit }[] = []): typeof fetch {
  let i = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    const r = replies[Math.min(i++, replies.length - 1)];
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
}
const completion = (content: string | null, extra: Record<string, unknown> = {}) => ({
  id: "chatcmpl-1", model: "m1", choices: [{ finish_reason: "stop", message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 3 } }, ...extra,
});
const base = { call: "extract" as const, model: "m1", system: "s", user: "u", maxTokens: 64, timeoutMs: 5000 };

describe("Token Factory request body", () => {
  it("encodes the three response_format variants and the reasoning knobs", () => {
    const schema = { name: "n", schema: { type: "object" } };
    expect(buildBody({ ...base, schema, format: "json_schema_raw", reasoning: "low_effort" })).toMatchObject({
      response_format: { type: "json_schema", json_schema: { type: "object" } }, chat_template_kwargs: { enable_thinking: true, low_effort: true }, temperature: 1.0, top_p: 0.95,
    });
    expect(buildBody({ ...base, schema, format: "json_schema_named", reasoning: "effort_low" })).toMatchObject({
      response_format: { type: "json_schema", json_schema: { name: "n", schema: { type: "object" }, strict: true } }, reasoning_effort: "low",
    });
    expect(buildBody({ ...base, format: "json_object", reasoning: "off" })).toMatchObject({ response_format: { type: "json_object" }, chat_template_kwargs: { enable_thinking: false } });
  });
});

describe("Token Factory call", () => {
  it("parses JSON content and records usage", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, fakeFetch([{ body: completion('{"a":1}') }]));
    expect(out.ok).toBe(true);
    expect(out.value).toEqual({ a: 1 });
    expect(out.receipt).toMatchObject({ requestId: "chatcmpl-1", promptTokens: 10, completionTokens: 5, reasoningTokens: 3, attempts: 1 });
  });

  it("strips a leaked reasoning trace and a code fence", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, fakeFetch([{ body: completion('<think>hmm</think>```json\n{"a":2}\n```') }]));
    expect(out.value).toEqual({ a: 2 });
  });

  it("treats empty content as an error after one json_object retry — never a faked answer", async () => {
    const out = await chat(tf, { ...base, format: "json_schema_raw", reasoning: "default" }, fakeFetch([{ body: completion("") }, { body: completion(null) }]));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/returned no answer/);
    expect(out.receipt.attempts).toBe(2);
    expect(out.receipt.format).toBe("json_object");
  });

  it("falls back to json_object when the endpoint rejects json_schema with a 400", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const out = await chat(tf, { ...base, schema: { name: "n", schema: {} }, format: "json_schema_named", reasoning: "default" }, fakeFetch([{ status: 400, body: { detail: "unsupported" } }, { body: completion('{"ok":true}') }], seen));
    expect(out.ok).toBe(true);
    expect(JSON.parse(String(seen[1].init.body)).response_format).toEqual({ type: "json_object" });
  });

  it("retries a reply that fails validation once, then reports the schema error", async () => {
    const validate = (v: unknown) => ((v as { a?: unknown }).a === 1 ? null : "a must be 1");
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default", validate }, fakeFetch([{ body: completion('{"a":2}') }, { body: completion('{"a":3}') }]));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/does not match the schema/);
  });

  it("retries 429 and 5xx, honouring retry-after", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, fakeFetch([{ status: 429, headers: { "retry-after": "0" } }, { status: 503 }, { body: completion('{"a":1}') }]));
    expect(out.ok).toBe(true);
    expect(out.receipt.attempts).toBe(3);
  });
});

describe("Tavily", () => {
  const keyed: TavilyConfig = { baseUrl: "https://tv.test", access: "key", apiKey: "tvly-x" };
  const keyless: TavilyConfig = { baseUrl: "https://tv.test", access: "keyless", apiKey: null };
  const searchBody = { results: [{ url: "https://a.example/1", title: "A", content: "x [...] y", raw_content: "page" }], usage: { credits: 1 }, request_id: "r1" };

  it("sends a Bearer key, always include_usage, and records credits + URLs", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const out = await search(keyed, "company", { query: exactQuery('PT "Maju" Jaya'), exact_match: true }, fakeFetch([{ body: searchBody }], seen));
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tvly-x");
    expect(JSON.parse(String(seen[0].init.body))).toMatchObject({ query: '"PT Maju Jaya"', exact_match: true, include_usage: true });
    expect(out.receipt).toMatchObject({ method: "search", purpose: "company", credits: 1, urls: ["https://a.example/1"], access: "key", requestId: "r1" });
  });

  it("uses the documented keyless header when there is no key, and says so in the receipt", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const out = await search(keyless, "pattern", { query: "q" }, fakeFetch([{ body: searchBody }], seen));
    expect((seen[0].init.headers as Record<string, string>)["X-Tavily-Access-Mode"]).toBe("keyless");
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(out.receipt.access).toBe("keyless");
  });

  it("retries once after a 429 retry-after, then reports errors without throwing", async () => {
    const ok = await search(keyed, "company", { query: "q" }, fakeFetch([{ status: 429, headers: { "retry-after": "0" } }, { body: searchBody }]));
    expect(ok.ok).toBe(true);
    const bad = await search(keyed, "company", { query: "q" }, fakeFetch([{ status: 432, body: "limit" }]));
    expect(bad.ok).toBe(false);
    expect(bad.receipt.error).toMatch(/432/);
  });

  it("caps extract at 5 URLs (1 credit at basic depth) with chunks_per_source 3", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    await extract(keyed, { urls: ["1", "2", "3", "4", "5", "6", "7"].map((n) => `https://g.go.id/${n}`), query: "visa" }, fakeFetch([{ body: { results: [], usage: { credits: 0 } } }], seen));
    const sent = JSON.parse(String(seen[0].init.body));
    expect(sent.urls).toHaveLength(5);
    expect(sent.chunks_per_source).toBe(3);
    expect(seen[0].url).toBe("https://tv.test/extract");
  });
});
