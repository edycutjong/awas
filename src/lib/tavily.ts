/**
 * Tavily client: `POST /search` and `POST /extract`, always with `include_usage:true` so every card can show the
 * credits Tavily itself reported. A 429 is retried once after the `retry-after` header (Tavily's documented rate-limit
 * response). Auth is a Bearer key; without one, the documented keyless mode (`X-Tavily-Access-Mode: keyless`) serves
 * the same responses at lower limits — the receipt records which mode answered.
 */

import type { TavilyConfig } from "./nebius/config";
import type { TavilyReceipt } from "./types";

export interface SearchResult {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string;
}

export interface SearchResponse {
  query?: string;
  results?: SearchResult[];
  usage?: { credits?: number };
  request_id?: string;
  response_time?: number;
}

export interface ExtractResult {
  url: string;
  raw_content?: string | null;
}

export interface ExtractResponse {
  results?: ExtractResult[];
  failed_results?: { url: string; error?: string }[];
  usage?: { credits?: number };
  request_id?: string;
}

export interface TavilyOutcome<T> {
  ok: boolean;
  body: T | null;
  receipt: TavilyReceipt;
}

/** `extract` bills 1 credit per 5 successful URLs at basic depth and accepts up to 20; Awas never sends more than 5. */
export const MAX_EXTRACT_URLS = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `retry-after` in seconds (an explicit 0 means "now"); the fallback applies only when the header is absent. */
export function retryAfterMs(header: string | null, fallbackMs: number, capMs: number): number {
  if (header === null || header.trim() === "") return fallbackMs;
  const s = Number(header);
  return Number.isFinite(s) && s >= 0 ? Math.min(s * 1000, capMs) : fallbackMs;
}

async function post<T extends { usage?: { credits?: number }; request_id?: string }>(
  cfg: TavilyConfig,
  method: TavilyReceipt["method"],
  purpose: TavilyReceipt["purpose"],
  params: Record<string, unknown>,
  urlsOf: (body: T) => string[],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<TavilyOutcome<T>> {
  const started = Date.now();
  const receipt: TavilyReceipt = { method, purpose, params, credits: null, ms: 0, urls: [], access: cfg.access };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.access === "key" && cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  else headers["X-Tavily-Access-Mode"] = "keyless";

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.baseUrl}/${method}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...params, include_usage: true }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      receipt.error = `Tavily ${method} failed: ${e instanceof Error ? e.message : String(e)}`;
      receipt.ms = Date.now() - started;
      return { ok: false, body: null, receipt };
    }
    if (res.status === 429 && attempt === 1) {
      await sleep(retryAfterMs(res.headers.get("retry-after"), 5_000, 30_000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      receipt.error = `Tavily ${method} returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
      receipt.ms = Date.now() - started;
      return { ok: false, body: null, receipt };
    }
    let body: T;
    try {
      body = (await res.json()) as T;
    } catch {
      receipt.error = `Tavily ${method} returned a response that is not JSON`;
      receipt.ms = Date.now() - started;
      return { ok: false, body: null, receipt };
    }
    receipt.credits = typeof body.usage?.credits === "number" ? body.usage.credits : null;
    receipt.requestId = body.request_id;
    receipt.urls = urlsOf(body);
    receipt.ms = Date.now() - started;
    return { ok: true, body, receipt };
  }
  /* v8 ignore next 2 */
  receipt.ms = Date.now() - started;
  return { ok: false, body: null, receipt };
}

export function search(
  cfg: TavilyConfig,
  purpose: TavilyReceipt["purpose"],
  params: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 30_000,
): Promise<TavilyOutcome<SearchResponse>> {
  return post<SearchResponse>(cfg, "search", purpose, params, (b) => (b.results ?? []).map((r) => r.url), fetchImpl, timeoutMs);
}

export function extract(
  cfg: TavilyConfig,
  params: { urls: string[]; query: string; chunks_per_source?: number },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 40_000,
): Promise<TavilyOutcome<ExtractResponse>> {
  const p = { ...params, urls: params.urls.slice(0, MAX_EXTRACT_URLS), chunks_per_source: params.chunks_per_source ?? 3 };
  return post<ExtractResponse>(cfg, "extract", "advisory", p, (b) => (b.results ?? []).map((r) => r.url), fetchImpl, timeoutMs);
}

/** A company or phone wrapped in quotes, as `exact_match` requires ("Wrap target phrases in quotes"). */
export function exactQuery(phrase: string): string {
  return `"${phrase.replace(/"/g, "").trim()}"`;
}
