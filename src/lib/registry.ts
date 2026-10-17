/**
 * The licensed-placement registry check (spec §4 SHOULD #2): a dated snapshot of the official P3MI list, looked up in
 * code. A query-ranked web search cannot prove a name is absent from a list of hundreds; a stored snapshot can say
 * exactly "not found on the list as of <date>".
 *
 * - The ad names an Indonesian company (PT / CV) that is not on the list → CAUTION, never STOP: the list changes, and
 *   ship-crew agencies are licensed elsewhere.
 * - The ad names an agency the list shows under suspension → CAUTION.
 * - Found and active → no flag, only a note: scammers reuse licensed names, so the family should contact the agency
 *   through the details on the list, not the number in the ad.
 */

import snapshot from "./data/p3mi-2026-10-17.json";
import { isCurriculumVitae, normalise } from "./text";
import type { RuleSource, Span } from "./types";

export interface RegistryAgency {
  name: string;
  status: string;
}

export interface RegistryResult {
  asOf: string;
  source: string;
  /** The listed agency the ad names, if any. */
  found: (RegistryAgency & { span: Span }) | null;
  /** The Indonesian company names in the ad that were looked up and are not on the list. */
  notListed: Span[];
}

const LEGAL_FORMS = new Set(["pt", "cv", "tbk", "persero"]);

function nameTokens(name: string): string[] {
  return (normalise(name).match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => !LEGAL_FORMS.has(t));
}

export const REGISTRY = {
  source: snapshot.source,
  asOf: snapshot.fetched,
  count: snapshot.count,
  agencies: snapshot.agencies.map(([name, status]) => ({ name, status, tokens: nameTokens(name) })),
};

export const REGISTRY_SOURCE: RuleSource = {
  url: snapshot.source,
  domain: "siskop2mi.bp2mi.go.id",
  title: `SISKOP2MI — List P3MI (${snapshot.count} licensed placement companies)`,
  date: snapshot.fetched,
  quote: "List P3MI",
};

function tokensWithOffsets(text: string): { t: string; start: number; end: number }[] {
  // Offsets on the raw text: NFKC + lowercase keep these ASCII-range names aligned, which is all we index.
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ t: m[0].normalize("NFKC").toLowerCase(), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** "PT Maju Jaya" / "CV. Sinar" in the ad: the Indonesian company names worth looking up. */
const INDONESIAN_COMPANY = /\b(?:PT|CV)\.?\s+(?:[A-Z0-9][\p{L}\p{N}&'’-]*\.?\s*){1,6}/gu;

export function checkRegistry(adText: string, extractedCompany?: Span): RegistryResult {
  const result: RegistryResult = { asOf: REGISTRY.asOf, source: REGISTRY.source, found: null, notListed: [] };
  const toks = tokensWithOffsets(adText);

  // 1. A listed name anywhere in the ad, on token boundaries. One-word names must follow "PT"/"CV" to count.
  let best: { agency: RegistryAgency; span: Span; len: number } | null = null;
  for (const agency of REGISTRY.agencies) {
    const n = agency.tokens;
    if (n.length === 0) continue;
    for (let i = 0; i + n.length <= toks.length; i++) {
      if (!n.every((t, k) => toks[i + k].t === t)) continue;
      if (n.length === 1 && !(i > 0 && LEGAL_FORMS.has(toks[i - 1].t))) continue;
      const span = { text: adText.slice(toks[i].start, toks[i + n.length - 1].end), start: toks[i].start, end: toks[i + n.length - 1].end };
      if (!best || n.length > best.len) best = { agency: { name: agency.name, status: agency.status }, span, len: n.length };
    }
  }
  if (best) {
    result.found = { ...best.agency, span: best.span };
    return result;
  }

  // 2. Otherwise every Indonesian company the ad names is "not found on the list as of <date>".
  const seen = new Set<string>();
  const add = (span: Span) => {
    const key = nameTokens(span.text).join(" ");
    if (key && !seen.has(key)) {
      seen.add(key);
      result.notListed.push(span);
    }
  };
  for (const m of adText.matchAll(INDONESIAN_COMPANY)) {
    if (isCurriculumVitae(adText, m.index ?? 0, m[0])) continue;
    const text = m[0].trim().replace(/[.,]$/, "");
    add({ text, start: m.index ?? 0, end: (m.index ?? 0) + text.length });
  }
  if (extractedCompany && /^(?:PT|CV)\b/i.test(extractedCompany.text.trim())) add(extractedCompany);
  return result;
}
