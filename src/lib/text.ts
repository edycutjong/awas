/**
 * Text normalisation shared by the rubric, the quote gate and the verdict.
 *
 * The quote gate compares a model-proposed quote with the page text Tavily returned. Both sides go through the same
 * `normalise()` (architecture contract): NFKC, lowercase, curly quotes / apostrophes / dashes to ASCII, markdown
 * emphasis and link syntax stripped, every run of whitespace collapsed to one space, trimmed. The normalised string
 * keeps an offset map back to the raw text, because two checks need the raw characters at the match: whether a
 * company name is continued by another capitalised word, and the first and last words for a text-fragment link.
 */

export interface Normalised {
  /** The normalised text. */
  text: string;
  /** `map[i]` is the index in the raw text of the character that produced `text[i]`. */
  map: number[];
}

const ZERO_WIDTH = /[​-‍⁠﻿­]/;
const SINGLE_QUOTES = /[‘’‚‛′ʼ`´]/;
const DOUBLE_QUOTES = /[“”„‟″«»]/;
const DASHES = /[‐-―−⸺⸻]/;

/** Indices of markdown syntax characters to drop: `[text](url)` → text, `**x**` / `_x_` → x. */
function markdownDrops(raw: string): Set<number> {
  const drop = new Set<number>();
  for (const m of raw.matchAll(/\[([^\]\n]{1,300})\]\(([^)\s]{1,500})\)/g)) {
    const start = m.index ?? 0;
    drop.add(start); // "["
    const close = start + 1 + m[1].length; // "]"
    for (let i = close; i < start + m[0].length; i++) drop.add(i);
  }
  // Emphasis markers: runs of * or _ touching a word on one side and whitespace/punctuation/edge on the other.
  for (const m of raw.matchAll(/(\*{1,3}|_{1,3})/g)) {
    const i = m.index ?? 0;
    const before = i === 0 ? " " : raw[i - 1];
    const after = i + m[0].length >= raw.length ? " " : raw[i + m[0].length];
    const wordBefore = /[\p{L}\p{N}]/u.test(before);
    const wordAfter = /[\p{L}\p{N}]/u.test(after);
    if (wordBefore !== wordAfter || (!wordBefore && !wordAfter)) {
      for (let k = 0; k < m[0].length; k++) drop.add(i + k);
    }
  }
  return drop;
}

export function normaliseWithMap(raw: string): Normalised {
  const drop = markdownDrops(raw);
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i++) {
    if (drop.has(i)) continue;
    const ch = raw[i];
    if (ZERO_WIDTH.test(ch)) continue;
    let mapped = ch.normalize("NFKC").toLowerCase();
    if (SINGLE_QUOTES.test(ch)) mapped = "'";
    else if (DOUBLE_QUOTES.test(ch)) mapped = '"';
    else if (DASHES.test(ch)) mapped = "-";
    if (/^\s+$/u.test(mapped)) {
      if (out.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      out.push(" ");
      map.push(i);
      pendingSpace = false;
    }
    for (const c of mapped) {
      out.push(c);
      map.push(i);
    }
  }
  return { text: out.join(""), map };
}

export function normalise(raw: string): string {
  return normaliseWithMap(raw).text;
}

/** Word tokens of normalised text: letter/digit runs (hyphenated words stay whole, e.g. "kerja-kerja"). */
export function words(s: string): string[] {
  return normalise(s).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Escape a literal string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A clause: the stretch of text around `index` bounded by clause punctuation (. , ; : ! ?) or a newline. The rubric's
 * negation guard and the fee flag's contract condition never look across these boundaries.
 */
export function clauseAround(text: string, start: number, end: number = start): { start: number; end: number; text: string } {
  let a = start;
  while (a > 0 && !isClauseBoundary(text, a - 1)) a--;
  let b = end;
  while (b < text.length && !isClauseBoundary(text, b)) b++;
  return { start: a, end: b, text: text.slice(a, b) };
}

/** Abbreviations whose full stop does not end a clause ("PT. Maju", "Rp. 5 juta", "s.d."). */
const ABBREVIATIONS = new Set(["pt", "cv", "rp", "no", "tbk", "ltd", "co", "inc", "jl", "kab", "kec", "dll", "dsb", "s", "d", "u", "a", "n", "mr", "mrs", "dr"]);

/** Is `text[i]` clause punctuation? A "." or "," between two digits ("15.000.000", "9,5") is part of a number. */
export function isClauseBoundary(text: string, i: number): boolean {
  const c = text[i];
  if (c === "\n" || c === "\r" || c === ";" || c === ":" || c === "!" || c === "?") return true;
  if (c !== "." && c !== ",") return false;
  if (/\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) return false;
  if (c === ".") {
    const m = text.slice(Math.max(0, i - 6), i).match(/([\p{L}]+)$/u);
    if (m && ABBREVIATIONS.has(m[1].toLowerCase())) return false;
  }
  return true;
}

/** Digits only. */
export function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * "CV" is also a curriculum vitae: "Kirim CV ke WA", "SEND CV WHATSAPP". A "CV <Name>" match is a company only when it
 * is not preceded by a sending verb and not followed by a channel or filler word.
 */
const CV_BEFORE = /\b(?:kirim|kirimkan|send|submit|upload|lampirkan|sertakan|bawa|email|e-mail|drop)\s*$/i;
const CV_AFTER = /^\s*(?:whatsapp|whats\s?app|wa|email|e-mail|anda|lengkap|terbaru|ke|to|via|melalui|segera|dan|and|atau|or|lamaran)\b/i;

export function isCurriculumVitae(text: string, matchStart: number, matchText: string): boolean {
  const at = matchStart + (matchText.length - matchText.trimStart().length);
  if (!/^cv\b/i.test(text.slice(at, at + 3))) return false;
  return CV_BEFORE.test(text.slice(Math.max(0, at - 20), at)) || CV_AFTER.test(text.slice(at + 2).replace(/^\./, ""));
}
