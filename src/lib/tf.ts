/**
 * Nebius Token Factory client (OpenAI-compatible chat completions) for NVIDIA Nemotron.
 *
 * Nemotron 3 Super is a reasoning model: with a small `max_tokens` it can think until it runs out of room and return
 * empty `content` (faultline, 2026-10-13). So every call leaves generous room, reads `content` only, and treats an
 * empty answer as an error — never as a line to show. Structured output: the Token Factory docs disagree on what
 * `response_format` accepts (the guide documents json_schema; the API reference says only json_object or text), so
 * the format is a per-call setting measured on day 0 (docs/proof/spike-*.json), and a reply that does not parse or
 * validate is retried once as `json_object` with the schema in the prompt.
 */

import type { TokenFactoryConfig } from "./nebius/config";
import { retryAfterMs } from "./tavily";
import type { TfCallReceipt } from "./types";

export type ResponseFormatVariant = "json_schema_raw" | "json_schema_named" | "json_object" | "text";
export type ReasoningKnob = "low_effort" | "effort_low" | "off" | "default";

export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatCall {
  call: TfCallReceipt["call"];
  model: string;
  system: string;
  user: string;
  schema?: JsonSchema;
  format: ResponseFormatVariant;
  reasoning: ReasoningKnob;
  maxTokens: number;
  timeoutMs: number;
  /** Validates the parsed JSON; returns an error string or null. */
  validate?: (value: unknown) => string | null;
}

export interface ChatOutcome<T = unknown> {
  ok: boolean;
  content: string | null;
  value: T | null;
  receipt: TfCallReceipt;
  error: string | null;
}

interface Completion {
  id?: string;
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number | null } | null };
}

export function buildBody(c: ChatCall, format: ResponseFormatVariant = c.format): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: c.model,
    messages: [
      { role: "system", content: c.system },
      { role: "user", content: c.user },
    ],
    max_tokens: c.maxTokens,
    // The model cards: temperature 1.0 and top_p 0.95 across all tasks.
    temperature: 1.0,
    top_p: 0.95,
  };
  if (format === "json_schema_raw" && c.schema) body.response_format = { type: "json_schema", json_schema: c.schema.schema };
  else if (format === "json_schema_named" && c.schema) body.response_format = { type: "json_schema", json_schema: { name: c.schema.name, schema: c.schema.schema, strict: true } };
  else if (format === "json_object" || ((format === "json_schema_raw" || format === "json_schema_named") && !c.schema)) body.response_format = { type: "json_object" };
  if (c.reasoning === "low_effort") body.chat_template_kwargs = { enable_thinking: true, low_effort: true };
  else if (c.reasoning === "off") body.chat_template_kwargs = { enable_thinking: false };
  else if (c.reasoning === "effort_low") body.reasoning_effort = "low";
  return body;
}

/** The answer text without any reasoning trace the template leaked into `content`. */
export function answerText(content: string | null | undefined): string {
  return (content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}

/** The first JSON object in a reply (tolerates a ```json fence or prose around it). */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(body.slice(start, end + 1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One logical call: up to 3 HTTP attempts for transient failures (no response, 429, 5xx), and one format retry
 * (`json_object`, schema already in the prompt) when the reply is empty of JSON or fails validation.
 */
export async function chat<T = unknown>(tf: TokenFactoryConfig, c: ChatCall, fetchImpl: typeof fetch = fetch): Promise<ChatOutcome<T>> {
  const started = Date.now();
  const receipt: TfCallReceipt = {
    call: c.call, model: c.model, promptTokens: null, completionTokens: null, reasoningTokens: null,
    ms: 0, format: c.format, attempts: 0,
  };
  const done = (patch: Partial<ChatOutcome<T>>): ChatOutcome<T> => {
    receipt.ms = Date.now() - started;
    return { ok: false, content: null, value: null, receipt, error: null, ...patch };
  };

  let format = c.format;
  let formatRetried = false;
  let lastError = "no attempt made";
  for (let attempt = 1; attempt <= 4; attempt++) {
    receipt.attempts = attempt;
    receipt.format = format;
    let res: Response;
    try {
      res = await fetchImpl(`${tf.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tf.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(c, format)),
        signal: AbortSignal.timeout(c.timeoutMs),
      });
    } catch (e) {
      lastError = `Token Factory request failed: ${e instanceof Error ? e.message : String(e)}`;
      if (attempt < 3) {
        await sleep(800 * attempt);
        continue;
      }
      return done({ error: lastError });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = `Token Factory returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
      // A format the endpoint rejects outright (400, or 422 as Token Factory answers a schema it refuses — day-0
      // spike) is retried once as json_object.
      if ((res.status === 400 || res.status === 422) && format !== "json_object" && format !== "text" && !formatRetried) {
        format = "json_object";
        formatRetried = true;
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(retryAfterMs(res.headers.get("retry-after"), 1200 * attempt, 20_000));
        continue;
      }
      return done({ error: lastError });
    }
    let body: Completion;
    try {
      body = (await res.json()) as Completion;
    } catch {
      lastError = "Token Factory returned a response that is not JSON";
      if (attempt < 3) continue;
      return done({ error: lastError });
    }
    receipt.requestId = body.id;
    receipt.model = body.model ?? c.model;
    receipt.promptTokens = (receipt.promptTokens ?? 0) + (body.usage?.prompt_tokens ?? 0);
    receipt.completionTokens = (receipt.completionTokens ?? 0) + (body.usage?.completion_tokens ?? 0);
    const rt = body.usage?.completion_tokens_details?.reasoning_tokens;
    if (typeof rt === "number") receipt.reasoningTokens = (receipt.reasoningTokens ?? 0) + rt;
    const choice = body.choices?.[0];
    const text = answerText(choice?.message?.content);
    if (!text) {
      // A reasoning model that thought until it ran out of room. Say so; never fake an answer.
      lastError = `the model returned no answer (finish_reason ${choice?.finish_reason ?? "unknown"}${typeof rt === "number" ? `, ${rt} reasoning tokens` : ""})`;
      if (!formatRetried && format !== "text") {
        formatRetried = true;
        format = "json_object";
        continue;
      }
      return done({ error: lastError });
    }
    if (format === "text" && !c.schema && !c.validate) return done({ ok: true, content: text });
    let value: unknown;
    try {
      value = parseJsonObject(text);
    } catch (e) {
      lastError = `reply is not JSON: ${e instanceof Error ? e.message : String(e)}`;
      if (!formatRetried) {
        formatRetried = true;
        format = "json_object";
        continue;
      }
      return done({ content: text, error: lastError });
    }
    const invalid = c.validate?.(value) ?? null;
    if (invalid) {
      lastError = `reply does not match the schema: ${invalid}`;
      if (!formatRetried) {
        formatRetried = true;
        format = "json_object";
        continue;
      }
      return done({ content: text, error: lastError });
    }
    return done({ ok: true, content: text, value: value as T });
  }
  return done({ error: lastError });
}
