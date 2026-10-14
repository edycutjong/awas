/**
 * The quote gate — the mechanism. The model chooses where to look; code decides what is shown.
 *
 * A proposed evidence line `{url, quote, claim}` is VERIFIED only if (architecture.md contract):
 *   - the URL is one Tavily returned in THIS run,
 *   - the quote has at least 6 words,
 *   - normalise(quote) is a substring of normalise(c) for ONE chunk c Tavily returned for that URL:
 *       search raw_content (include_raw_content:"text") is one chunk — the whole page text;
 *       search `content` and extract `raw_content` (query-ranked) are split on the "[...]" separator.
 * A line that fails is dropped and shown greyed. Only the quote is gated; the claim is "Awas's reading".
 *
 * For a verified line the gate also computes the three facts the verdict reads:
 *   entity   — the quote names the ad's company (full name incl. legal form, contiguous on token boundaries, not
 *              continued by another capitalised word in the raw page text) or contains an extracted phone's last
 *              9 digits inside one number. Phone-only, generic-word names and ALL-CAPS text are "capped": they can
 *              raise VERIFY FIRST but never STOP.
 *   negative — a negative-event term (verdict.ts NEGATIVE_TERMS).
 *   guard    — a guard term anywhere, or "bukan" within 5 words before the company name (misused or denied).
 */

import { createHash } from "node:crypto";
import { companyTokens } from "./rubric";
import { digits, normalise, normaliseWithMap, words } from "./text";
import type { DropReason, EvidenceLine, TavilyReceipt } from "./types";
import { guardTerms, negativeTerms } from "./verdict";

export const MIN_QUOTE_WORDS = 6;

/** Words that do not make a company name distinctive on their own (beyond its legal form). Tuned on the dev set. */
export const GENERIC_NAME_WORDS = new Set([
  "sejahtera", "jaya", "abadi", "mandiri", "global", "indonesia", "international", "internasional", "makmur", "sentosa",
  "utama", "maju", "bersama", "sukses", "karya", "putra", "putri", "mulia", "persada", "nusantara", "group", "grup",
  "perkasa", "raya", "sakti", "agung", "baru", "prima", "cipta", "mitra", "sarana", "lestari", "bersaudara", "mega",
]);

const LEGAL_FORMS = new Set(["pt", "cv", "tbk", "ud", "ltd", "co", "inc", "llc", "sdn", "bhd", "plc", "corp", "company", "corporation"]);

export interface Chunk {
  text: string;
  basis: "page" | "ranked";
}

export interface SourceDoc {
  url: string;
  title?: string;
  chunks: Chunk[];
  /** The highest-priority lookup that returned this URL: company > phone > advisory > pattern. */
  purpose: TavilyReceipt["purpose"];
}

export type Corpus = Map<string, SourceDoc>;

const PURPOSE_RANK: Record<TavilyReceipt["purpose"], number> = { company: 0, phone: 1, advisory: 2, pattern: 3 };

/** Add Tavily text to the run's corpus. `rankedText` is split on the "[...]" separator. */
export function addToCorpus(
  corpus: Corpus,
  url: string,
  purpose: TavilyReceipt["purpose"],
  opts: { title?: string; pageText?: string | null; rankedText?: string | null },
): void {
  const doc = corpus.get(url) ?? { url, title: opts.title, chunks: [], purpose };
  if (PURPOSE_RANK[purpose] < PURPOSE_RANK[doc.purpose]) doc.purpose = purpose;
  if (!doc.title && opts.title) doc.title = opts.title;
  const push = (text: string, basis: Chunk["basis"]) => {
    const t = text.trim();
    if (t && !doc.chunks.some((c) => c.text === t && c.basis === basis)) doc.chunks.push({ text: t, basis });
  };
  if (opts.pageText) push(opts.pageText, "page");
  if (opts.rankedText) for (const part of opts.rankedText.split("[...]")) push(part, "ranked");
  corpus.set(url, doc);
}

export interface GateContext {
  company?: string;
  phones: string[];
}

export interface Proposal {
  url: string;
  quote: string;
  claim: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function chunkSetHash(doc: SourceDoc, basis: Chunk["basis"]): string {
  return sha256(doc.chunks.filter((c) => c.basis === basis).map((c) => c.text).join("\n[...]\n"));
}

function dropped(p: Proposal, reason: DropReason, purpose?: TavilyReceipt["purpose"]): EvidenceLine {
  return {
    url: p.url, quote: p.quote, claim: p.claim, status: "dropped", reason,
    entity: false, entityCapped: false, entityKind: null, negative: false, guard: false, chunkBasis: "page", purpose,
  };
}

export function gateLine(p: Proposal, corpus: Corpus, ctx: GateContext): EvidenceLine {
  const doc = corpus.get(p.url);
  if (!doc) return dropped(p, "url_not_returned");
  if (words(p.quote).length < MIN_QUOTE_WORDS) return dropped(p, "too_short", doc.purpose);
  const nq = normalise(p.quote);
  if (!nq) return dropped(p, "too_short", doc.purpose);

  for (const chunk of doc.chunks) {
    const nc = normaliseWithMap(chunk.text);
    const at = nc.text.indexOf(nq);
    if (at < 0) continue;
    const rawStart = nc.map[at];
    const rawEnd = nc.map[at + nq.length - 1] + 1;
    const rawQuote = chunk.text.slice(rawStart, rawEnd);
    const entity = entityMatch(nq, at, nc, chunk.text, ctx);
    return {
      url: p.url,
      title: doc.title,
      quote: rawQuote,
      claim: p.claim,
      status: "verified",
      entity: entity.matched,
      entityCapped: entity.capped,
      entityKind: entity.kind,
      negative: negativeTerms(nq).length > 0,
      guard: guardTerms(nq).length > 0 || entity.bukanBefore,
      chunkBasis: chunk.basis,
      pageSha256: chunkSetHash(doc, chunk.basis),
      matchOffset: rawStart,
      fragmentUrl: fragmentUrl(p.url, rawQuote),
      purpose: doc.purpose,
    };
  }
  const joined = normalise(doc.chunks.map((c) => c.text).join(" "));
  return dropped(p, joined.includes(nq) ? "spans_chunks" : "not_in_page", doc.purpose);
}

interface EntityResult {
  matched: boolean;
  capped: boolean;
  kind: "company" | "phone" | null;
  bukanBefore: boolean;
}

/** Token runs with their offsets in a normalised string. */
function tokenise(s: string): { t: string; start: number; end: number }[] {
  return [...s.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ t: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

function entityMatch(nq: string, at: number, nc: { text: string; map: number[] }, rawChunk: string, ctx: GateContext): EntityResult {
  const none: EntityResult = { matched: false, capped: false, kind: null, bukanBefore: false };
  let best: EntityResult = none;

  if (ctx.company) {
    const name = companyTokens(ctx.company);
    const qt = tokenise(nq);
    if (name.length > 0) {
      for (let i = 0; i + name.length <= qt.length; i++) {
        if (!name.every((tok, k) => qt[i + k].t === tok)) continue;
        // Raw-text check: the name must not continue with another capitalised word ("PT Mega" ≠ "PT Mega Karya").
        const last = qt[i + name.length - 1];
        const rawFrom = nc.map[at + qt[i].start];
        const rawTo = nc.map[at + last.end - 1] + 1;
        const occurrence = rawChunk.slice(rawFrom, rawTo);
        const after = rawChunk.slice(rawTo).match(/^([ \t ]+)([\p{L}][\p{L}\p{N}]*)/u);
        const nextWord = after?.[2] ?? "";
        const allCaps = !/\p{Ll}/u.test(occurrence) && (nextWord === "" || !/\p{Ll}/u.test(nextWord));
        const continued = !allCaps && /^\p{Lu}/u.test(nextWord);
        if (continued) continue;
        const distinctive = name.filter((t) => !LEGAL_FORMS.has(t));
        const generic = distinctive.length === 0 || distinctive.every((t) => GENERIC_NAME_WORDS.has(t));
        const before = qt.slice(Math.max(0, i - 5), i).map((x) => x.t);
        const result: EntityResult = { matched: true, capped: allCaps || generic, kind: "company", bukanBefore: before.includes("bukan") };
        if (!result.capped) return result;
        if (!best.matched) best = result;
      }
    }
  }

  for (const phone of ctx.phones) {
    const last9 = digits(phone).slice(-9);
    if (last9.length < 9) continue;
    for (const m of nq.matchAll(/\+?\d[\d\s.-]{6,}\d/g)) {
      if (digits(m[0]).includes(last9)) {
        return best.matched ? best : { matched: true, capped: true, kind: "phone", bukanBefore: false };
      }
    }
  }
  return best;
}

/**
 * A text-fragment link: `url#:~:text=<start>,<end>`, the first and last ~4 words of the quote as it appears in the
 * page text, percent-encoded (the "-" and "," of text-fragment syntax are escaped, so hyphenated Indonesian words
 * like "iming-iming" survive). The browser scrolls to and highlights the quote; if the rendered page differs, it
 * simply opens the page top — the Playwright check (scripts) records which links actually highlight.
 */
export function fragmentUrl(url: string, rawQuote: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
  const w = rawQuote.split(/\s+/).filter(Boolean);
  const base = url.split("#")[0];
  if (w.length <= 8) return `${base}#:~:text=${enc(w.join(" "))}`;
  return `${base}#:~:text=${enc(w.slice(0, 4).join(" "))},${enc(w.slice(-4).join(" "))}`;
}
