/**
 * Error-path and edge branches of the Token Factory and Tavily clients (fake fetch only, no network).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { answerText, buildBody, chat, parseJsonObject } from "@/lib/tf";
import { exactQuery, extract, retryAfterMs, search } from "@/lib/tavily";
import type { TavilyConfig, TokenFactoryConfig } from "@/lib/nebius/config";

const tf: TokenFactoryConfig = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "m1", propose: "m2", message: "m3" } };
const base = { call: "extract" as const, model: "m1", system: "s", user: "u", maxTokens: 64, timeoutMs: 5000 };
const ok = (content: string | null, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ id: "i", model: "mm", choices: [{ finish_reason: "stop", message: { content } }], ...extra }), { status: 200 });
const seq = (...steps: (Response | Error | (() => Response))[]): typeof fetch => {
  let i = 0;
  return (async () => {
    const s = steps[Math.min(i++, steps.length - 1)];
    if (s instanceof Error) throw s;
    if (typeof s === "function") return s();
    return s instanceof Response ? s.clone() : s;
  }) as typeof fetch;
};

afterEach(() => vi.restoreAllMocks());

describe("tf buildBody / parse helpers", () => {
  it("falls back to json_object when a json_schema format has no schema; plain text sets no response_format", () => {
    expect(buildBody({ ...base, format: "json_schema_raw", reasoning: "default" })).toMatchObject({ response_format: { type: "json_object" } });
    expect(buildBody({ ...base, format: "json_schema_named", reasoning: "default" })).toMatchObject({ response_format: { type: "json_object" } });
    expect(buildBody({ ...base, format: "text", reasoning: "default" }).response_format).toBeUndefined();
    const withSchema = { name: "n", schema: {} };
    expect(buildBody({ ...base, schema: withSchema, format: "text", reasoning: "default" }).response_format).toBeUndefined();
  });
  it("answerText / parseJsonObject edge cases", () => {
    expect(answerText(undefined)).toBe("");
    expect(answerText("lead</think> {\"a\":1}")).toBe('{"a":1}');
    expect(() => parseJsonObject("no braces here")).toThrow(/no JSON object/);
    expect(() => parseJsonObject("}{")).toThrow(/no JSON object/);
    expect(parseJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("tf chat error paths", () => {
  it("retries a thrown fetch twice with a backoff, then reports the failure", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Error("boom"), new Error("boom2"), new Error("down")));
    expect(out.ok).toBe(false);
    expect(out.error).toBe("Token Factory request failed: down");
    expect(out.receipt.attempts).toBe(3);
  });
  it("stringifies a non-Error throw and recovers on the next attempt", async () => {
    const thrower: typeof fetch = (async () => { throw "plain string"; }) as unknown as typeof fetch;
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, thrower);
    expect(out.error).toBe("Token Factory request failed: plain string");
  });
  it("returns a non-retryable HTTP error with its body, and tolerates an unreadable body", async () => {
    const withText = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Response("nope", { status: 401 })));
    expect(withText.error).toBe("Token Factory returned 401: nope");
    const noText = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Response("", { status: 404 })));
    expect(noText.error).toBe("Token Factory returned 404");
    const unreadable = { ok: false, status: 500, headers: new Headers(), text: () => Promise.reject(new Error("x")) } as unknown as Response;
    const bad = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(unreadable, unreadable, unreadable));
    expect(bad.error).toBe("Token Factory returned 500");
  });
  it("does not format-retry a 400 once json_object/text is already in use", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Response("bad", { status: 400 })));
    expect(out.error).toMatch(/400/);
    expect(out.receipt.attempts).toBe(1);
  });
  it("gives up on a 5xx at the third attempt", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Response("", { status: 503, headers: { "retry-after": "0" } })));
    expect(out.error).toBe("Token Factory returned 503");
    expect(out.receipt.attempts).toBe(3);
  });
  it("retries a non-JSON HTTP 200 body, then reports it", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(new Response("<html>", { status: 200 })));
    expect(out.error).toBe("Token Factory returned a response that is not JSON");
    expect(out.receipt.attempts).toBe(3);
  });
  it("copes with a body that has no choices/usage/model and reports finish_reason unknown", async () => {
    const empty = () => new Response(JSON.stringify({}), { status: 200 });
    const out = await chat(tf, { ...base, format: "text", reasoning: "default" }, seq(empty));
    expect(out.error).toBe("the model returned no answer (finish_reason unknown)");
    expect(out.receipt.model).toBe("m1");
    expect(out.receipt.promptTokens).toBe(0);
    expect(out.receipt.attempts).toBe(1);
  });
  it("names the reasoning tokens when the model thought without answering, and accumulates them", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(
      ok("", { usage: { prompt_tokens: 1, completion_tokens: 2, completion_tokens_details: { reasoning_tokens: 7 } } }),
    ));
    expect(out.error).toBe("the model returned no answer (finish_reason stop, 7 reasoning tokens)");
    expect(out.receipt.reasoningTokens).toBe(14);
  });
  it("returns plain text for a format=text call without schema/validator", async () => {
    const out = await chat(tf, { ...base, format: "text", reasoning: "default" }, seq(ok("just a line")));
    expect(out).toMatchObject({ ok: true, content: "just a line", value: null });
  });
  it("retries a reply that is not JSON once, then returns the text with the error", async () => {
    const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(ok("prose"), ok("more prose")));
    expect(out.ok).toBe(false);
    expect(out.content).toBe("more prose");
    expect(out.error).toMatch(/reply is not JSON/);
    const parseFail = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(ok("{bad json}"), ok("{still bad}")));
    expect(parseFail.error).toMatch(/reply is not JSON/);
  });
  it("reports a non-Error throw from the JSON parser by its string form", async () => {
    const plain = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) } as unknown as Response;
    const spy = vi.spyOn(JSON, "parse").mockImplementation(() => { throw "weird"; });
    try {
      const out = await chat(tf, { ...base, format: "json_object", reasoning: "default" }, seq(plain, plain));
      expect(out.error).toBe("reply is not JSON: weird");
    } finally {
      spy.mockRestore();
    }
  });
  it("accepts a valid JSON reply after the format retry and validates with an always-ok validator", async () => {
    const out = await chat<{ a: number }>(tf, { ...base, format: "json_object", reasoning: "default", validate: () => null }, seq(ok("prose"), ok('{"a":1}')));
    expect(out.value).toEqual({ a: 1 });
    expect(out.receipt.attempts).toBe(2);
  });
});

describe("Tavily edge branches", () => {
  const keyed: TavilyConfig = { baseUrl: "https://tv.test", access: "key", apiKey: "tvly-x" };
  const noKey: TavilyConfig = { baseUrl: "https://tv.test", access: "key", apiKey: null };
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

  it("retryAfterMs: blank, missing, negative and non-numeric headers use the fallback; the cap applies", () => {
    expect(retryAfterMs(null, 5, 9)).toBe(5);
    expect(retryAfterMs("  ", 5, 9000)).toBe(5);
    expect(retryAfterMs("abc", 5, 9000)).toBe(5);
    expect(retryAfterMs("-1", 5, 9000)).toBe(5);
    expect(retryAfterMs("100", 5, 9000)).toBe(9000);
    expect(retryAfterMs("2", 5, 9000)).toBe(2000);
  });
  it("key access without a key falls back to the keyless header", async () => {
    let headers: Record<string, string> = {};
    const f = (async (_u: unknown, init?: RequestInit) => { headers = init?.headers as Record<string, string>; return json({ results: [] }); }) as typeof fetch;
    const out = await search(noKey, "pattern", { query: "q" }, f);
    expect(headers["X-Tavily-Access-Mode"]).toBe("keyless");
    expect(out.receipt.urls).toEqual([]);
    expect(out.receipt.credits).toBeNull();
  });
  it("a thrown fetch is a failed outcome, not an exception", async () => {
    const out = await search(keyed, "company", { query: "q" }, seq(new Error("offline")));
    expect(out).toMatchObject({ ok: false, body: null });
    expect(out.receipt.error).toBe("Tavily search failed: offline");
    const nonError = await extract(keyed, { urls: ["https://a.test"], query: "q" }, (async () => { throw "str"; }) as unknown as typeof fetch);
    expect(nonError.receipt.error).toBe("Tavily extract failed: str");
  });
  it("a non-JSON 200 body and an unreadable error body are failed outcomes", async () => {
    const notJson = await search(keyed, "company", { query: "q" }, seq(new Response("<html>", { status: 200 })));
    expect(notJson.receipt.error).toBe("Tavily search returned a response that is not JSON");
    const bare = await search(keyed, "company", { query: "q" }, seq(new Response("", { status: 500 })));
    expect(bare.receipt.error).toBe("Tavily search returned 500");
    const unreadable = { ok: false, status: 502, headers: new Headers(), text: () => Promise.reject(new Error("x")) } as unknown as Response;
    const out = await search(keyed, "company", { query: "q" }, seq(unreadable));
    expect(out.receipt.error).toBe("Tavily search returned 502");
  });
  it("a second 429 is final (one retry only)", async () => {
    const r = () => new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    const out = await search(keyed, "company", { query: "q" }, seq(r, r));
    expect(out.ok).toBe(false);
    expect(out.receipt.error).toMatch(/429: slow down/);
  });
  it("records titles (missing title becomes empty) and extract urls", async () => {
    const s = await search(keyed, "company", { query: "q" }, seq(json({ results: [{ url: "https://a.test" }, { url: "https://b.test", title: "B" }], usage: { credits: 2 } })));
    expect(s.receipt.titles).toEqual(["", "B"]);
    expect(s.receipt.credits).toBe(2);
    const e = await extract(keyed, { urls: ["https://a.test"], query: "q", chunks_per_source: 1 }, seq(json({ results: [{ url: "https://a.test", raw_content: "x" }] })));
    expect(e.receipt.urls).toEqual(["https://a.test"]);
    const none = await extract(keyed, { urls: ["https://a.test"], query: "q" }, seq(json({})));
    expect(none.receipt.urls).toEqual([]);
    const noResults = await search(keyed, "company", { query: "q" }, seq(json({})));
    expect(noResults.receipt.titles).toEqual([]);
  });
  it("exactQuery strips quotes and trims", () => {
    expect(exactQuery('  "a" b ')).toBe('"a b"');
  });
});
