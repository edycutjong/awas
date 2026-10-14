/**
 * The red-flag rubric — deterministic code, not the model.
 *
 * Every flag fires on the model's extracted field OR a keyword/regex rule over the raw ad text, so a prompt-injected
 * or mis-extracted ad cannot silently drop a flag. Every Indonesian rule has an English twin (English pastes are
 * invited). NEVER-class rules stop the check on their own, but only when an official source is recorded for them in
 * `RULE_SOURCES`; a NEVER rule without one is drawn and counted as CAUTION.
 *
 * Negation guard (NEVER rules and the fee flags): no match when a negator directly governs the phrase — it ends right
 * before the phrase, optionally followed by one filler word ("tanpa biaya", "bukan visa turis", "No placement fee",
 * "tidak pakai visa turis", "not a tourist visa"). The guard never looks across clause punctuation or a newline, so
 * "tanpa pengalaman. Visa turis diurus" still fires. The fee flags also have a post-head guard: costs the ad says are
 * covered in the same clause ("Semua biaya ditanggung perusahaan sebelum berangkat") do not fire — unless the clause
 * says the worker bears them ("ditanggung oleh pekerja"). The visa flag has no post-head guard on purpose:
 * "visa turis ditanggung perusahaan" is still a tourist visa for work.
 */

import { clauseAround, normalise } from "./text";
import type { Extraction, Flag, FlagClass, FlagId, RuleSource, Span } from "./types";
import { RULE_SOURCES } from "./rule-sources";

/* ------------------------------------------------------------------------------------------ */
/* Negation                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const NEGATORS_1 = new Set([
  "tanpa", "tidak", "tak", "bukan", "non", "bebas", "gratis", "jangan", "dilarang",
  "no", "not", "never", "without", "zero", "nil",
]);
const NEGATORS_2 = new Set(["tidak ada", "free of", "do not", "does not", "don t", "doesn t", "will not", "won t"]);
const FILLERS = new Set(["a", "an", "the", "any", "pakai", "memakai", "menggunakan", "perlu", "ada", "dengan", "untuk", "use", "using", "need", "require", "required"]);

function tokensOf(s: string): string[] {
  return s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function endsWithNegator(toks: string[]): boolean {
  const n = toks.length;
  if (n >= 1 && NEGATORS_1.has(toks[n - 1])) return true;
  if (n >= 2 && NEGATORS_2.has(`${toks[n - 2]} ${toks[n - 1]}`)) return true;
  return false;
}

/** Is the phrase starting at `start` governed by a negator right before it, inside the same clause? */
export function negatedBefore(text: string, start: number): boolean {
  const clause = clauseAround(text, start);
  const toks = tokensOf(text.slice(clause.start, start));
  if (endsWithNegator(toks)) return true;
  // One filler word between the negator and the phrase: "tidak pakai visa turis", "not a tourist visa".
  if (toks.length >= 2 && FILLERS.has(toks[toks.length - 1]) && endsWithNegator(toks.slice(0, -1))) return true;
  return false;
}

const COVERED = /\b(ditanggung|dibebaskan|gratis|free|covered)\b|\brp\.?\s?0\b(?![.,]?\d)|\bpaid by (the )?(employer|company)\b/i;
const BORNE_BY_WORKER = /\b(ditanggung|dibayar|dibebankan)\s+(oleh\s+)?(pekerja|pmi|cpmi|calon|sendiri|pelamar|peserta|anda|kamu)\b|\bpaid by (the )?(worker|applicant|candidate|you)\b/i;

/** Costs the ad itself says are covered, after the phrase head and inside the same clause (fee flags only). */
export function coveredAfter(text: string, start: number, end: number): boolean {
  const clause = clauseAround(text, start, end);
  const tail = text.slice(start, clause.end);
  return COVERED.test(tail) && !BORNE_BY_WORKER.test(tail);
}

/* ------------------------------------------------------------------------------------------ */
/* Patterns                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const FEE_HEAD_ID = String.raw`(?:uang|biaya)\s+(?:penempatan|pendaftaran|administrasi|admin|proses|pengurusan|pemberangkatan|jasa|muka|jaminan)?\s*`;
const FEE_HEAD_EN = String.raw`\b(?:placement|recruitment|processing|agency|service|admin|administration|registration|visa)?\s*(?:fee|fees|deposit|charge|charges|payment)\b`;

/** The rule set. Order is the display order. */
const PATTERNS: Record<FlagId, RegExp[]> = {
  tourist_visa: [
    /\bvisa\s+(?:turis|kunjungan|wisata|pelancong|liburan)\b/giu,
    /\btourist\s+visas?\b/giu,
    /\bvisit\s+visas?\b(?!\s+holders?)/giu,
  ],
  // The fee head; `CONTRACT_WORDS` must also occur in the clause (checked below).
  fee_before_contract: [
    new RegExp(String.raw`\b${FEE_HEAD_ID}.{0,30}?\b(?:sebelum|dulu|di\s*muka)\b`, "giu"),
    new RegExp(String.raw`${FEE_HEAD_EN}.{0,30}?\bbefore\b`, "giu"),
  ],
  passport_retention: [
    /\bpaspor\b.{0,20}?\b(?:ditahan|disimpan|diserahkan|dititipkan|dipegang|diambil)\b/giu,
    /\bpassports?\b.{0,20}?\b(?:held|kept|surrendered|handed\s+over|retained|confiscated)\b/giu,
    /\b(?:hold|keep|retain|confiscate)s?\b.{0,20}?\bpassports?\b/giu,
  ],
  fee_before_departure: [
    new RegExp(String.raw`\b${FEE_HEAD_ID}.{0,30}?\bsebelum\s+(?:berangkat|keberangkatan|pemberangkatan|terbang)\b`, "giu"),
    new RegExp(String.raw`${FEE_HEAD_EN}.{0,30}?\bbefore\s+(?:departure|departing|flying|you\s+fly|leaving)\b`, "giu"),
  ],
  high_pay_no_experience: [
    /\b(?:tanpa|tidak\s+(?:perlu|butuh|harus|wajib)|tak\s+perlu|bebas)\s+(?:ada\s+)?pengalaman\b|\bpengalaman\s+tidak\s+(?:diperlukan|dibutuhkan|wajib|harus)\b|\bfresh\s*graduate\b/giu,
    /\bno\s+(?:prior\s+|previous\s+|work\s+)?experience\b|\bwithout\s+(?:any\s+)?experience\b|\bexperience\s+(?:is\s+)?not\s+(?:required|needed|necessary)\b/giu,
  ],
  advisory_destination: [],
  personal_recruiter: [],
  visit_visa_holder: [/\bvisit\s+visas?\s+holders?\b/giu],
};

const CONTRACT_WORDS = /\b(kontrak|tanda\s*tangan|ttd|dp|uang\s+jaminan|contract|deposit|signing|signed)\b/i;
const DEPARTURE_WORDS = /\b(berangkat|keberangkatan|pemberangkatan|departure|departing|flying)\b/i;

const NEVER_RULES: FlagId[] = ["tourist_visa", "fee_before_contract", "passport_retention"];

export const FLAG_LABELS: Record<FlagId, { id: string; en: string }> = {
  tourist_visa: { id: "Iklan menawarkan visa turis/kunjungan untuk bekerja", en: "The ad offers a tourist or visit visa for work" },
  fee_before_contract: { id: "Iklan meminta biaya sebelum ada kontrak", en: "The ad asks for a fee before a contract is signed" },
  passport_retention: { id: "Iklan menyebut paspor ditahan atau diserahkan", en: "The ad says the passport is held or handed over" },
  fee_before_departure: { id: "Iklan meminta biaya sebelum berangkat", en: "The ad asks for a fee before departure" },
  high_pay_no_experience: { id: "Gaji tinggi tanpa perlu pengalaman", en: "High pay with no experience needed" },
  advisory_destination: { id: "Negara tujuan disebut dalam peringatan resmi", en: "The destination is named in an official warning" },
  personal_recruiter: { id: "Perekrut hanya nomor pribadi, tanpa nama perusahaan", en: "The recruiter is a personal number with no company named" },
  visit_visa_holder: { id: "Iklan menerima pemegang visa kunjungan", en: "The ad accepts visit-visa holders" },
};

/* ------------------------------------------------------------------------------------------ */
/* Pay and destination                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Monthly pay figures in an ad, in IDR. Amounts in USD are converted at `PAY.usdToIdr` (a recorded constant). */
export function payFigures(text: string): { idr: number; span: Span }[] {
  const out: { idr: number; span: Span }[] = [];
  const num = (raw: string): number => {
    const s = raw.trim();
    // "15.000.000" / "15,000,000" are thousands separators; "9,5" / "9.5" with 1–2 decimals is a decimal.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    return Number(s.replace(",", "."));
  };
  const push = (m: RegExpMatchArray, idr: number) => {
    if (Number.isFinite(idr) && idr > 0) out.push({ idr, span: { text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length } });
  };
  for (const m of text.matchAll(/\brp\.?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(jt|juta|jutaan|rb|ribu|k)?\b/giu)) {
    const unit = (m[2] ?? "").toLowerCase();
    const mult = unit.startsWith("j") ? 1_000_000 : unit === "rb" || unit === "ribu" || unit === "k" ? 1_000 : 1;
    push(m, num(m[1]) * mult);
  }
  for (const m of text.matchAll(/(?<!rp\.?\s?)\b(\d+(?:[.,]\d{1,2})?)\s*(jt|juta)\b/giu)) push(m, num(m[1]) * 1_000_000);
  for (const m of text.matchAll(/(?:\busd|\bus\$|\$)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/giu)) push(m, num(m[1]) * PAY.usdToIdr);
  for (const m of text.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{3,})\s*(?:usd|us\s?dollars?|dollars?|dolar)\b/giu)) push(m, num(m[1]) * PAY.usdToIdr);
  return out;
}

/** The "high pay" constant. Its source and value live in rule-sources.ts. */
export const PAY = RULE_SOURCES.pay;

export const ADVISORY = RULE_SOURCES.advisory;

function advisoryMatches(text: string): Span[] {
  const out: Span[] = [];
  for (const place of ADVISORY.places) {
    const re = new RegExp(String.raw`\b${place.pattern}\b`, "giu");
    for (const m of text.matchAll(re)) out.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out.sort((a, b) => a.start - b.start);
}

const LEGAL_COMPANY = /\b(?:PT|CV)\.?\s+[A-Z0-9][\p{L}\p{N}&.'-]*/u;
const FOREIGN_COMPANY = /\b[A-Z][\p{L}&'-]+(?:\s+[A-Z][\p{L}&'-]+)*\s+(?:Co\.?,?\s*Ltd\.?|Ltd\.?|Inc\.?|LLC|Sdn\.?\s*Bhd\.?|Group|Company|Corporation)\b/u;
const CONTACT = /(?:\+?62|\b0)8\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\b(?:wa|whatsapp|whats\s?app|hubungi|telp|telepon|hp|dm|inbox)\b/giu;

/* ------------------------------------------------------------------------------------------ */
/* Evaluation                                                                                  */
/* ------------------------------------------------------------------------------------------ */

interface Hit {
  span: Span;
  via: "model" | "pattern";
}

function patternHits(id: FlagId, text: string): Hit[] {
  const hits: Hit[] = [];
  for (const re of PATTERNS[id]) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!guardsPass(id, text, start, end)) continue;
      hits.push({ span: { text: m[0], start, end }, via: "pattern" });
    }
  }
  return hits;
}

/** The negation / clause conditions for one candidate match. */
function guardsPass(id: FlagId, text: string, start: number, end: number): boolean {
  const clause = clauseAround(text, start, end);
  switch (id) {
    case "tourist_visa":
    case "visit_visa_holder":
      return !negatedBefore(text, start);
    case "passport_retention": {
      if (negatedBefore(text, start)) return false;
      const inside = text.slice(start, end);
      // "paspor tidak akan ditahan", "passport will not be held", "keep your own passport", "dipegang sendiri"
      if (/\b(tidak|tak|bukan|jangan|dilarang|not|never|no)\b/i.test(inside)) return false;
      if (/\b(own|sendiri)\b/i.test(text.slice(start, clause.end))) return false;
      return true;
    }
    case "fee_before_contract":
      return !negatedBefore(text, start) && !coveredAfter(text, start, end) && CONTRACT_WORDS.test(clause.text);
    case "fee_before_departure":
      return !negatedBefore(text, start) && !coveredAfter(text, start, end);
    case "high_pay_no_experience":
      return true;
    default:
      return true;
  }
}

/** The model's extracted fields, read through the same guards (the field's span sits inside the ad). */
function modelHits(id: FlagId, text: string, ex: Extraction | null): Hit[] {
  if (!ex) return [];
  const hits: Hit[] = [];
  const add = (span: Span | undefined, ok: boolean) => {
    if (span && ok) hits.push({ span, via: "model" });
  };
  switch (id) {
    case "tourist_visa":
      add(ex.visa, !!ex.visa && /\b(turis|kunjungan|wisata|pelancong|liburan|tourist|visit|on\s+arrival|voa)\b/i.test(ex.visa.text) &&
        !/\bholders?\b/i.test(ex.visa.text) && !negatedBefore(text, ex.visa.start));
      break;
    case "fee_before_contract":
    case "fee_before_departure":
      for (const fee of ex.fees) {
        const clause = clauseAround(text, fee.start, fee.end);
        const before = /\b(sebelum|dulu|di\s*muka|before|upfront|in\s+advance)\b/i.test(clause.text);
        const kind = id === "fee_before_contract" ? CONTRACT_WORDS.test(clause.text) : DEPARTURE_WORDS.test(clause.text);
        add(fee, before && kind && !negatedBefore(text, fee.start) && !coveredAfter(text, fee.start, fee.end));
      }
      break;
    case "advisory_destination":
      add(ex.destination, !!ex.destination && advisoryMatches(ex.destination.text).length > 0);
      break;
    default:
      break;
  }
  return hits;
}

function sourceFor(id: FlagId): RuleSource | null {
  return RULE_SOURCES.flags[id] ?? null;
}

function makeFlag(id: FlagId, hits: Hit[]): Flag | null {
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.span.start - b.span.start);
  const vias = new Set(hits.map((h) => h.via));
  const source = sourceFor(id);
  const declared: FlagClass = NEVER_RULES.includes(id) ? "NEVER" : "CAUTION";
  const sourced = source !== null;
  return {
    id,
    class: declared === "NEVER" && sourced ? "NEVER" : "CAUTION",
    sourced,
    via: vias.size === 2 ? "both" : (hits[0].via as "model" | "pattern"),
    span: hits[0].span,
    label: FLAG_LABELS[id].en,
    source,
  };
}

/**
 * Evaluate every flag over the raw ad text (and the model's extraction, when there is one).
 * `extraction` is null for the rubric-only ablation column and when the extraction call failed.
 */
export function evaluateRubric(adText: string, extraction: Extraction | null): Flag[] {
  const flags: Flag[] = [];
  const ids: FlagId[] = [
    "tourist_visa", "fee_before_contract", "passport_retention",
    "fee_before_departure", "high_pay_no_experience", "advisory_destination", "personal_recruiter", "visit_visa_holder",
  ];
  for (const id of ids) {
    let hits: Hit[];
    if (id === "high_pay_no_experience") hits = highPayHits(adText, extraction);
    else if (id === "advisory_destination") hits = [...advisoryMatches(adText).map((span) => ({ span, via: "pattern" as const })), ...modelHits(id, adText, extraction)];
    else if (id === "personal_recruiter") hits = personalRecruiterHits(adText, extraction);
    else hits = [...patternHits(id, adText), ...modelHits(id, adText, extraction)];
    // A fee that is "before departure" AND "before a contract" is the stronger NEVER flag only.
    const flag = makeFlag(id, dedupeHits(hits));
    if (flag) flags.push(flag);
  }
  if (flags.some((f) => f.id === "fee_before_contract")) {
    return flags.filter((f) => !(f.id === "fee_before_departure" && overlapsFlag(f, flags.find((g) => g.id === "fee_before_contract"))));
  }
  return flags;
}

function overlapsFlag(a: Flag, b: Flag | undefined): boolean {
  return !!b && a.span.start < b.span.end && b.span.start < a.span.end;
}

function dedupeHits(hits: Hit[]): Hit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.span.start}:${h.span.end}:${h.via}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function highPayHits(text: string, ex: Extraction | null): Hit[] {
  const noExp = patternHits("high_pay_no_experience", text);
  const modelNoExp = (ex?.promises ?? []).filter((p) => PATTERNS.high_pay_no_experience.some((re) => new RegExp(re.source, "iu").test(p.text)));
  if (noExp.length === 0 && modelNoExp.length === 0) return [];
  const high = payFigures(text).filter((p) => p.idr >= PAY.thresholdIdr);
  if (high.length === 0) return [];
  const hits: Hit[] = [];
  if (noExp.length > 0) hits.push({ span: noExp[0].span, via: "pattern" });
  if (modelNoExp.length > 0) hits.push({ span: modelNoExp[0], via: "model" });
  return hits;
}

function personalRecruiterHits(text: string, ex: Extraction | null): Hit[] {
  const hits: Hit[] = [];
  const contacts = [...text.matchAll(CONTACT)];
  const namedCompany = LEGAL_COMPANY.test(text) || FOREIGN_COMPANY.test(text);
  if (!namedCompany && contacts.length > 0) {
    const m = contacts[0];
    hits.push({ span: { text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }, via: "pattern" });
  }
  if (ex && !ex.company && ex.phones.length > 0) hits.push({ span: ex.phones[0], via: "model" });
  return hits;
}

/** Normalised company name tokens (legal forms "PT." → "pt"), used by Tavily queries and the gate. */
export function companyTokens(company: string): string[] {
  return normalise(company).replace(/\b(pt|cv)\./g, "$1").match(/[\p{L}\p{N}]+/gu) ?? [];
}
