/**
 * Token Factory call 3 — explanation, the Bahasa family message and an English gloss of each verified quote.
 *
 * The model writes prose; code assembles the message. Every quote in the final message is a quote the gate verified,
 * inserted by code and followed by the canonical attribution "Dilaporkan oleh <source>, bukan tuduhan kami." /
 * "Reported by <source>, not our accusation." The model's own sentences may not name the ad's company and may not
 * carry quotations of their own; a reply that does is regenerated once, then replaced by the code-written template.
 * A gloss must keep every hedge of its quote (diduga → allegedly, ...), else the card says "translation unavailable".
 */

import { mentionsCompany, maskAll } from "./mask";
import { CALL_SETTINGS } from "./settings";
import { normalise } from "./text";
import { chat } from "./tf";
import type { TokenFactoryConfig } from "./nebius/config";
import type { EvidenceLine, Flag, TfCallReceipt, Verdict } from "./types";

export const VERDICT_WORDS: Record<Verdict, { id: string; en: string }> = {
  STOP: { id: "STOP — jangan berangkat dulu", en: "STOP — do not travel yet" },
  VERIFY_FIRST: { id: "PERIKSA DULU", en: "VERIFY FIRST" },
  NO_RED_FLAGS_FOUND: { id: "TIDAK DITEMUKAN TANDA BAHAYA (bukan jaminan)", en: "NO RED FLAGS FOUND (not a guarantee)" },
};

export const RETENTION = {
  id: "Hasil ini disimpan 75 hari, tidak diindeks mesin pencari, nomor telepon disamarkan.",
  en: "This result is kept 75 days, not indexed by search engines; phone numbers are masked.",
};

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function attribution(url: string, lang: "id" | "en"): string {
  return lang === "id" ? `Dilaporkan oleh ${domainOf(url)}, bukan tuduhan kami.` : `Reported by ${domainOf(url)}, not our accusation.`;
}

/** Hedges in a quote and the English words that keep them. */
export const HEDGES: { id: RegExp; en: RegExp; word: string }[] = [
  { word: "diduga", id: /\b(diduga|dugaan|terduga)\b/, en: /\b(allegedly|alleged|suspected|suspect|suspects)\b/i },
  { word: "disebut", id: /\bdisebut\b/, en: /\b(reportedly|said|allegedly|alleged|described)\b/i },
  { word: "dilaporkan", id: /\bdilaporkan\b/, en: /\b(reportedly|reported)\b/i },
  { word: "dikabarkan", id: /\bdikabarkan\b/, en: /\b(reportedly|reported|rumou?red)\b/i },
];

export function glossKeepsHedges(quote: string, gloss: string): boolean {
  const nq = normalise(quote);
  return HEDGES.every((h) => !h.id.test(nq) || h.en.test(gloss));
}

export interface Steps {
  id: string[];
  en: string[];
}

/** The concrete checks for VERIFY FIRST (and STOP): only steps that follow from the rules that fired. */
export function verifySteps(flags: Flag[]): Steps {
  const has = (id: string) => flags.some((f) => f.id === id);
  const id: string[] = [];
  const en: string[] = [];
  id.push("Cek nama perusahaan di daftar resmi P3MI (siskop2mi.bp2mi.go.id) — hubungi perusahaan lewat kontak di daftar itu, bukan nomor di iklan.");
  en.push("Check the company on the official licensed-agency (P3MI) list at siskop2mi.bp2mi.go.id — contact it through the details on that list, not the number in the ad.");
  if (has("fee_before_contract") || has("fee_before_departure")) {
    id.push("Jangan bayar biaya apa pun sebelum ada perjanjian kerja tertulis.");
    en.push("Do not pay any fee before there is a written work contract.");
  }
  if (has("tourist_visa") || has("visit_visa_holder")) {
    id.push("Tanyakan jenis visanya: bekerja di luar negeri harus dengan visa kerja, bukan visa turis atau kunjungan.");
    en.push("Ask which visa: working abroad needs a work visa, not a tourist or visit visa.");
  }
  if (has("passport_retention")) {
    id.push("Jangan serahkan paspor kepada perekrut.");
    en.push("Do not hand your passport to a recruiter.");
  }
  if (has("personal_recruiter")) {
    id.push("Minta nama perusahaan dan nomor izinnya, jangan hanya lewat nomor pribadi.");
    en.push("Ask for the company's name and licence number, not just a personal number.");
  }
  return { id, en };
}

export interface MessageInput {
  verdict: Verdict;
  rule: string;
  reasons: string[];
  flags: Flag[];
  /** Verified lines to quote (at most 2), in display order. */
  lines: EvidenceLine[];
  company?: string;
  phones: string[];
}

export interface MessageResult {
  messageId: string;
  messageEn: string;
  explanationEn: string;
  glosses: Map<number, { gloss: string; ok: boolean }>;
  source: "model" | "template";
  receipt: TfCallReceipt | null;
  error: string | null;
}

interface RawMessage {
  explanation_en: string;
  intro_id: string;
  advice_id: string;
  intro_en: string;
  advice_en: string;
  glosses?: { line: number; gloss_en: string }[];
}

export const MESSAGE_SYSTEM = `You write the result of a job-ad check for an Indonesian family. You receive the verdict (decided by code — never change it), the rules that fired, and numbered quotes that code has verified on published pages.

Write:
- "explanation_en": 2–3 plain English sentences explaining why the verdict is what it is.
- "intro_id": 1–2 short sentences in plain Indonesian for a relative to forward: what the check found.
- "advice_id": 1–2 short sentences in plain Indonesian: what to do now.
- "intro_en" and "advice_en": the same two parts in English.
- "glosses": for each numbered quote, {"line": n, "gloss_en": a faithful English translation}. Keep every hedge: "diduga"/"dugaan"/"terduga" → "allegedly"/"suspected", "disebut" → "reportedly"/"said", "dilaporkan"/"dikabarkan" → "reportedly".

Rules: never name any company, person or phone number in your own sentences (the quotes are added by code, with their source). Do not put quotation marks or quotes in your own sentences. Never call anything "safe" or guaranteed. Return ONLY a JSON object with the keys above.`;

function validateMessage(v: unknown): string | null {
  if (!v || typeof v !== "object") return "not an object";
  const o = v as Record<string, unknown>;
  for (const k of ["explanation_en", "intro_id", "advice_id", "intro_en", "advice_en"]) if (typeof o[k] !== "string" || !(o[k] as string).trim()) return `${k} missing`;
  return null;
}

/** The model's own sentences may not name the company and may not carry quotations of their own. */
export function proseProblem(raw: RawMessage, company: string | undefined): string | null {
  const parts = [raw.explanation_en, raw.intro_id, raw.advice_id, raw.intro_en, raw.advice_en];
  if (parts.some((p) => mentionsCompany(p, company))) return "names the company in its own words";
  if (parts.some((p) => /["“”„«»]/.test(p))) return "carries a quotation of its own";
  return null;
}

export function assemble(verdict: Verdict, prose: { introId: string; adviceId: string; introEn: string; adviceEn: string }, lines: EvidenceLine[], glosses: Map<number, { gloss: string; ok: boolean }>): { id: string; en: string } {
  const quotedId = lines.map((l) => `“${l.quote}” — ${attribution(l.url, "id")}`);
  const quotedEn = lines.map((l, i) => {
    const g = glosses.get(i + 1);
    return g?.ok ? `“${g.gloss}” (translated) — ${attribution(l.url, "en")}` : `“${l.quote}” (Indonesian original) — ${attribution(l.url, "en")}`;
  });
  const id = [`${VERDICT_WORDS[verdict].id}. ${prose.introId}`, ...quotedId, prose.adviceId, RETENTION.id].filter(Boolean).join("\n\n");
  const en = [`${VERDICT_WORDS[verdict].en}. ${prose.introEn}`, ...quotedEn, prose.adviceEn, RETENTION.en].filter(Boolean).join("\n\n");
  return { id, en };
}

export function templateProse(input: MessageInput): { introId: string; adviceId: string; introEn: string; adviceEn: string; explanationEn: string } {
  const steps = verifySteps(input.flags);
  const reasonsEn = input.reasons.join("; ");
  const n = input.lines.length;
  if (input.verdict === "STOP") {
    return {
      introId: `Pemeriksaan ini menemukan tanda bahaya pada iklan tersebut${n > 0 ? ", dan ada laporan yang diterbitkan di bawah ini" : ""}.`,
      adviceId: steps.id.slice(0, 3).join(" "),
      introEn: `This check found red flags in the ad${n > 0 ? ", and published reports are quoted below" : ""}.`,
      adviceEn: steps.en.slice(0, 3).join(" "),
      explanationEn: `Awas says STOP because: ${reasonsEn}.`,
    };
  }
  if (input.verdict === "VERIFY_FIRST") {
    return {
      introId: "Pemeriksaan ini menemukan hal yang perlu dipastikan sebelum ada yang berangkat atau membayar.",
      adviceId: steps.id.slice(0, 3).join(" "),
      introEn: "This check found things to confirm before anyone travels or pays.",
      adviceEn: steps.en.slice(0, 3).join(" "),
      explanationEn: `Awas says VERIFY FIRST because: ${reasonsEn}.`,
    };
  }
  return {
    introId: "Pemeriksaan ini tidak menemukan tanda bahaya, tetapi itu bukan jaminan.",
    adviceId: steps.id[0],
    introEn: "This check found no red flags, but that is not a guarantee.",
    adviceEn: steps.en[0],
    explanationEn: "Every step completed and no rule fired. Awas cannot prove an offer is genuine.",
  };
}

export async function writeMessage(tf: TokenFactoryConfig | null, input: MessageInput, fetchImpl: typeof fetch = fetch): Promise<MessageResult> {
  const glossesFallback = new Map<number, { gloss: string; ok: boolean }>();
  const fromTemplate = (receipt: TfCallReceipt | null, error: string | null): MessageResult => {
    const t = templateProse(input);
    const msg = assemble(input.verdict, t, input.lines, glossesFallback);
    return { messageId: msg.id, messageEn: msg.en, explanationEn: t.explanationEn, glosses: glossesFallback, source: "template", receipt, error };
  };
  if (!tf) return fromTemplate(null, "Token Factory is not configured");

  const s = CALL_SETTINGS.message;
  const numbered = input.lines.map((l, i) => `[${i + 1}] “${l.quote}” — ${domainOf(l.url)}`).join("\n");
  const user = [
    `Verdict (decided by code): ${input.verdict.replace(/_/g, " ")}`,
    `Why: ${input.reasons.join("; ") || "no rule fired"}`,
    `Verified quotes:\n${numbered || "(none)"}`,
    `Steps to suggest: ${verifySteps(input.flags).en.join(" ")}`,
  ].join("\n\n");

  let lastReceipt: TfCallReceipt | null = null;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<RawMessage>(tf, {
      call: "message", model: tf.models.message, system: MESSAGE_SYSTEM, user,
      format: s.format, reasoning: s.reasoning, maxTokens: s.maxTokens, timeoutMs: s.timeoutMs, validate: validateMessage,
    }, fetchImpl);
    lastReceipt = out.receipt;
    if (!out.ok || !out.value) {
      lastError = out.error;
      break;
    }
    const problem = proseProblem(out.value, input.company);
    if (problem) {
      lastError = `message ${problem}`;
      continue;
    }
    const glosses = new Map<number, { gloss: string; ok: boolean }>();
    for (const g of out.value.glosses ?? []) {
      const line = input.lines[g.line - 1];
      if (!line || typeof g.gloss_en !== "string") continue;
      const quoteNames = mentionsCompany(line.quote, input.company);
      const gloss = quoteNames ? g.gloss_en : maskAll(g.gloss_en, input.company, input.phones, "en");
      glosses.set(g.line, { gloss, ok: glossKeepsHedges(line.quote, g.gloss_en) && !!g.gloss_en.trim() });
    }
    const prose = { introId: out.value.intro_id.trim(), adviceId: out.value.advice_id.trim(), introEn: out.value.intro_en.trim(), adviceEn: out.value.advice_en.trim() };
    const msg = assemble(input.verdict, prose, input.lines, glosses);
    return { messageId: msg.id, messageEn: msg.en, explanationEn: out.value.explanation_en.trim(), glosses, source: "model", receipt: out.receipt, error: null };
  }
  return fromTemplate(lastReceipt, lastError);
}
