/**
 * The evidence file's view model. Live runs build it event by event from the SSE stream; recorded samples and shared
 * case links build it from a stored pack. Both render through the same component, so a judge sees exactly what a
 * family sees.
 */

import type { EvidenceLine, EvidencePack, Extraction, Flag, FlagId, Receipt, TavilyReceipt, Verdict } from "./types";

export type LineState = "pending" | "verified" | "dropped";

export interface ViewLine extends Partial<EvidenceLine> {
  index: number;
  state: LineState;
  url: string;
  quote: string;
}

export interface View {
  status: "idle" | "running" | "done" | "error" | "rate_limited" | "bad_input";
  adText: string;
  extraction: Extraction | null;
  flags: Flag[];
  ruleStop: FlagId[];
  tavily: TavilyReceipt[];
  lines: ViewLine[];
  verdict: Verdict | null;
  rule: string;
  reasons: string[];
  steps: string[];
  messageId: string;
  messageEn: string;
  explanationEn: string;
  messageSource: "model" | "template" | null;
  receipt: Receipt | null;
  errors: { step: string; message: string }[];
  caseId: string | null;
  badInput: string | null;
  recordedAt: string | null;
  sampleLabel: string | null;
  mode: EvidencePack["mode"] | null;
}

export function emptyView(adText = ""): View {
  return {
    status: "idle", adText, extraction: null, flags: [], ruleStop: [], tavily: [], lines: [], verdict: null, rule: "",
    reasons: [], steps: [], messageId: "", messageEn: "", explanationEn: "", messageSource: null, receipt: null,
    errors: [], caseId: null, badInput: null, recordedAt: null, sampleLabel: null, mode: null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function reduce(v: View, event: string, data: any): View {
  switch (event) {
    case "started":
      return { ...v, status: "running", caseId: data.caseId ?? null, mode: data.mode ?? "live" };
    case "extracted":
      return { ...v, extraction: data.extraction ?? null };
    case "flags":
      return { ...v, flags: data.flags ?? [] };
    case "rule_stop":
      return { ...v, ruleStop: data.flags ?? [] };
    case "tavily_call":
      return { ...v, tavily: [...v.tavily, data.call] };
    case "line_pending":
      return { ...v, lines: [...v.lines.filter((l) => l.index !== data.index), { index: data.index, state: "pending" as const, url: data.url, quote: data.quote }].sort((a, b) => a.index - b.index) };
    case "line_verified":
    case "line_dropped":
      return {
        ...v,
        lines: v.lines.map((l) => (l.index === data.index ? { ...l, ...data.line, index: data.index, state: event === "line_verified" ? "verified" : "dropped" } : l)),
      };
    case "verdict":
      return { ...v, verdict: data.verdict, rule: data.rule, reasons: data.reasons ?? [], steps: data.steps ?? [] };
    case "message": {
      const glosses: Record<string, { gloss: string; ok: boolean }> = data.glosses ?? {};
      return {
        ...v,
        messageId: data.messageId, messageEn: data.messageEn, explanationEn: data.explanationEn, messageSource: data.source,
        lines: applyGlosses(v.lines, glosses),
      };
    }
    case "receipt":
      return { ...v, receipt: data.receipt };
    case "step_error":
      return { ...v, errors: [...v.errors, { step: data.step, message: data.message ?? "" }] };
    case "rate_limited":
      return { ...v, status: "rate_limited" };
    case "bad_input":
      return { ...v, status: "bad_input", badInput: data.reason };
    case "done":
      return { ...v, status: v.status === "rate_limited" || v.status === "bad_input" ? v.status : data.caseId ? "done" : "error", caseId: data.caseId ?? v.caseId };
    default:
      return v;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The message step's glosses belong to the verified lines it quoted, in order. */
/** Glosses arrive keyed by the line's own index (pipeline.ts). */
function applyGlosses(lines: ViewLine[], glosses: Record<string, { gloss: string; ok: boolean }>): ViewLine[] {
  return lines.map((l) => {
    const g = l.state === "verified" ? glosses[String(l.index)] : undefined;
    return g ? { ...l, gloss: g.ok ? g.gloss : undefined, glossStatus: g.ok ? "ok" : "unavailable" } : l;
  });
}

export function viewFromPack(pack: EvidencePack): View {
  return {
    ...emptyView(pack.adTextMasked),
    status: pack.done ? "done" : "error",
    extraction: pack.extraction,
    flags: pack.flags,
    ruleStop: pack.flags.filter((f) => f.class === "NEVER").map((f) => f.id),
    tavily: pack.tavily,
    lines: pack.lines.map((l, index) => ({ ...l, index, state: l.status })),
    verdict: pack.verdict,
    rule: pack.rule,
    steps: pack.verifySteps,
    messageId: pack.messageId,
    messageEn: pack.messageEn,
    explanationEn: pack.explanationEn,
    messageSource: pack.messageSource,
    receipt: pack.receipt,
    errors: pack.receipt.failedSteps.map((s) => ({ step: s, message: "" })),
    caseId: pack.id,
    recordedAt: pack.recordedAt ?? null,
    sampleLabel: pack.sampleLabel ?? null,
    mode: pack.mode,
  };
}

/** Parse a text/event-stream body into (event, data) pairs, as they arrive. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: unknown) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data.push(line.slice(6));
      }
      try {
        onEvent(event, JSON.parse(data.join("\n") || "null"));
      } catch {
        // A malformed block is skipped; the stored pack remains the source of truth.
      }
    }
  }
}
