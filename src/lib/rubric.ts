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
 *
 * Rules match the content of an offer — pay figures, fees, visa type, destination, departure speed, debt, company
 * identity — never the narrative words a news report uses about one (korban, iming-iming, dijanjikan, tergiur, modus):
 * the benchmark's positives are reporters' descriptions, and a rule that keyed on their vocabulary would score well
 * there and catch nothing in a real ad (bench/PROTOCOL.md Amendment 4).
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

/** A money amount in an Indonesian ad: "Rp 2 juta", "Rp. 500.000", "3 jt", "750 ribu". */
const AMOUNT_ID = String.raw`(?:\brp\.?\s?\d|\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b)`;

/** The rule set. */
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
  non_placement_country: [],
  // Any fee asked to get the job (Kemnaker): a fee word with an amount in the same sentence, an amount "for" a cost,
  // or money "for" the papers. The amount may not be the pay ("gaji Rp 8 juta").
  fee_asked: [
    new RegExp(String.raw`\b(?:biaya|bayar|membayar|dibayar|bayaran|setor|setoran|menyetor|menyetorkan|transfer|mentransfer|dp|deposit|uang\s+(?:muka|pendaftaran|administrasi|admin|proses|jaminan|tiket|visa|pengurusan))\b(?:(?!gaji|upah|salary|penghasilan|bonus)[^.;:!?\n]){0,40}?${AMOUNT_ID}`, "giu"),
    new RegExp(String.raw`${AMOUNT_ID}[^.;:!?\n]{0,25}?\b(?:untuk|buat|sebagai)\s+(?:biaya|ongkos|pendaftaran|administrasi|admin|proses|pengurusan|tiket|visa|paspor|medical|medis|pelatihan|jaminan)\b`, "giu"),
    /\buang\s+(?:untuk|buat)\s+(?:mengurus|pengurusan|biaya|tiket|dokumen|paspor|visa|administrasi|pendaftaran|proses|keberangkatan)\b/giu,
    new RegExp(String.raw`\b(?:fee|fees|deposit|charge|charges|payment)\b(?:(?!salary|wage|income|\bpay\b)[^.;:!?\n]){0,40}?(?:\$|\busd|\bus\$|\brp\.?|\bidr|\bphp|\bmyr|\brm|\baed|\bsgd)\s?\d`, "giu"),
    /\bpay\s+(?:a|an|the)?\s*(?:\w+\s+)?(?:fee|deposit|charge)\b/giu,
  ],
  // Costs advanced ("ditalangi"), then taken out of the pay (Polri checklist item 5).
  debt_bondage: [
    /\b(?:di)?talangi\b|\b(?:dana\s+)?talangan\b|\bdipotong\s+(?:dari\s+)?gaji\b|\bpotong(?:an)?\s+gaji\b|\bgaji\s+(?:\p{L}+\s+){0,2}dipotong\b|\bdicicil\s+(?:dari|lewat|melalui|dengan)\s+gaji\b|\bpinjaman\b|\bkasbon\b/giu,
    /\bdeducted\s+from\s+(?:your\s+|the\s+)?(?:salary|wages?|pay)\b|\b(?:salary|wage)\s+deductions?\b|\bloans?\b/giu,
  ],
  // A very fast departure with no selection or training (Polri checklist item 1).
  quick_departure: [
    /\b(?:langsung|cepat|segera|siap)\s+(?:di)?berangkat(?:kan)?\b/giu,
    /\b(?:proses|keberangkatan|pemberangkatan|berangkat|penempatan)\s+(?:sangat\s+|super\s+)?(?:cepat|kilat|instan|singkat|ekspres|express)\b/giu,
    /\bberangkat\s+(?:dalam|kurang\s+dari|maksimal|maks|max)\s+\d+\s*(?:hari|minggu|pekan)\b/giu,
    /\b(?:tanpa|tidak\s+(?:perlu|pakai|ada|wajib))\s+(?:tes|test|seleksi|pelatihan|training|interview|wawancara|kursus)\b/giu,
    /\b(?:minggu|pekan|bulan)\s+(?:ini|depan)\s+(?:langsung\s+)?berangkat\b/giu,
    /\b(?:fast|quick|immediate|express|instant)\s+(?:departure|process(?:ing)?|deployment|placement|hiring)\b/giu,
    /\b(?:fly|depart|leave)\s+(?:within|in)\s+\d+\s+(?:days?|weeks?)\b/giu,
    /\bno\s+(?:interview|test|training|selection)\b/giu,
  ],
  high_pay_light_work: [],
  no_company: [],
};

const CONTRACT_WORDS = /\b(kontrak|tanda\s*tangan|ttd|dp|uang\s+jaminan|contract|deposit|signing|signed)\b/i;
const DEPARTURE_WORDS = /\b(berangkat|keberangkatan|pemberangkatan|departure|departing|flying)\b/i;

const NEVER_RULES: FlagId[] = ["tourist_visa", "fee_before_contract", "passport_retention", "non_placement_country"];

/** The order flags are evaluated and listed in: NEVER rules first. */
export const FLAG_ORDER: FlagId[] = [
  "tourist_visa", "fee_before_contract", "passport_retention", "non_placement_country",
  "fee_before_departure", "fee_asked", "debt_bondage", "high_pay_no_experience", "high_pay_light_work", "quick_departure",
  "advisory_destination", "personal_recruiter", "no_company", "visit_visa_holder",
];

export const FLAG_LABELS: Record<FlagId, { id: string; en: string }> = {
  tourist_visa: { id: "Iklan menawarkan visa turis/kunjungan untuk bekerja", en: "The ad offers a tourist or visit visa for work" },
  fee_before_contract: { id: "Iklan meminta biaya sebelum ada kontrak", en: "The ad asks for a fee before a contract is signed" },
  passport_retention: { id: "Iklan menyebut paspor ditahan atau diserahkan", en: "The ad says the passport is held or handed over" },
  fee_before_departure: { id: "Iklan meminta biaya sebelum berangkat", en: "The ad asks for a fee before departure" },
  high_pay_no_experience: { id: "Gaji tinggi tanpa perlu pengalaman", en: "High pay with no experience needed" },
  advisory_destination: { id: "Negara tujuan disebut dalam peringatan resmi", en: "The destination is named in an official warning" },
  personal_recruiter: { id: "Perekrut hanya nomor pribadi, tanpa nama perusahaan", en: "The recruiter is a personal number with no company named" },
  visit_visa_holder: { id: "Iklan menerima pemegang visa kunjungan", en: "The ad accepts visit-visa holders" },
  non_placement_country: { id: "Negara tujuan bukan negara penempatan resmi pekerja migran", en: "The destination is not an official placement country" },
  fee_asked: { id: "Iklan meminta biaya untuk mendapatkan pekerjaan", en: "The ad asks for a fee to get the job" },
  debt_bondage: { id: "Biaya ditalangi, lalu dipotong dari gaji", en: "Costs advanced, then deducted from pay" },
  high_pay_light_work: { id: "Gaji sangat tinggi untuk pekerjaan ringan", en: "Very high pay for light office work" },
  quick_departure: { id: "Janji berangkat cepat tanpa seleksi atau pelatihan", en: "A fast departure with no selection or training" },
  no_company: { id: "Iklan tidak menyebut nama perusahaan", en: "The ad names no company" },
};

/* ------------------------------------------------------------------------------------------ */
/* Pay and destination                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Pay figures in an ad, in their own currency (rupiah or US dollars). No conversion: each has its own cited threshold. */
export function payFigures(text: string): { amount: number; currency: "IDR" | "USD"; span: Span }[] {
  const out: { amount: number; currency: "IDR" | "USD"; span: Span }[] = [];
  const num = (raw: string): number => {
    const s = raw.trim();
    // "15.000.000" / "15,000,000" are thousands separators; "9,5" / "9.5" with 1–2 decimals is a decimal.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    return Number(s.replace(",", "."));
  };
  const push = (m: RegExpMatchArray, amount: number, currency: "IDR" | "USD") => {
    if (Number.isFinite(amount) && amount > 0) out.push({ amount, currency, span: { text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length } });
  };
  for (const m of text.matchAll(/\brp\.?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(jt|juta|jutaan|rb|ribu|k)?\b/giu)) {
    const unit = (m[2] ?? "").toLowerCase();
    const mult = unit.startsWith("j") ? 1_000_000 : unit === "rb" || unit === "ribu" || unit === "k" ? 1_000 : 1;
    push(m, num(m[1]) * mult, "IDR");
  }
  for (const m of text.matchAll(/(?<!rp\.?\s?)\b(\d+(?:[.,]\d{1,2})?)\s*(jt|juta)\b/giu)) push(m, num(m[1]) * 1_000_000, "IDR");
  for (const m of text.matchAll(/(?:\busd|\bus\$|\$)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/giu)) push(m, num(m[1]), "USD");
  for (const m of text.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{3,})\s*(?:usd|us\s?dollars?|dollars?|dolar)\b/giu)) push(m, num(m[1]), "USD");
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

/** "Not a placement country" mentions, skipping a negated one ("bukan ke Kamboja", "not in Myanmar"). */
function nonPlacementMatches(text: string): { span: Span; source: RuleSource }[] {
  const out: { span: Span; source: RuleSource }[] = [];
  for (const place of RULE_SOURCES.nonPlacement.places) {
    const re = new RegExp(String.raw`\b(?:${place.pattern})\b`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      if (negatedPlace(text, start)) continue;
      out.push({ span: { text: m[0], start, end: start + m[0].length }, source: place.source });
    }
  }
  return out.sort((a, b) => a.span.start - b.span.start);
}

const PLACE_PREPOSITIONS = new Set(["ke", "di", "menuju", "untuk", "dari", "to", "in", "for", "from"]);

/** "bukan ke Kamboja", "tidak di Myanmar", "not to Cambodia": a negator, then at most a preposition. */
function negatedPlace(text: string, start: number): boolean {
  if (negatedBefore(text, start)) return true;
  const clause = clauseAround(text, start);
  const toks = tokensOf(text.slice(clause.start, start));
  return toks.length >= 2 && PLACE_PREPOSITIONS.has(toks[toks.length - 1]) && endsWithNegator(toks.slice(0, -1));
}

/** Light office work, the examples the Polri checklist gives (admin, customer service) and their usual ad titles. */
const LIGHT_WORK = /\b(?:admin(?:istrasi)?|customer\s+service|layanan\s+pelanggan|cs\s+online|cs|telemarketing|marketing(?:\s+(?:online|digital))?|data\s+entry|entri\s+data|input\s+data|e-?commerce|online\s+shop|toko\s+online|operator\s+(?:komputer|online|chat|game)|pekerja\s+kantor(?:an)?|kerja\s+kantor(?:an)?|staf+\s+kantor|office\s+(?:staff|work|job|assistant)|typist|kerja\s+online|host\s+live|live\s+streaming|trading|trader)\b/giu;
const LIGHT_WORK_IT = /\bIT\b/u;

/** Pay claimed in words: "gaji besar", "gaji tinggi", "belasan juta", "high salary". */
const PAY_WORDS = /\bgaji\s+(?:sangat\s+|super\s+)?(?:besar|tinggi|gede|fantastis|menggiurkan)\b|\b(?:belasan|puluhan)\s+juta\b|\bhigh\s+(?:salary|pay|income)\b/giu;

/** High pay in an ad: a figure at or above the cited threshold, or a high-pay claim in words. */
function highPaySpans(text: string): Span[] {
  const figures = payFigures(text)
    .filter((p) => (p.currency === "IDR" ? p.amount >= PAY.thresholdIdr : p.amount >= PAY.thresholdUsd))
    .map((p) => p.span);
  const words = [...text.matchAll(PAY_WORDS)].map((m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  return [...figures, ...words].sort((a, b) => a.start - b.start);
}

const LEGAL_COMPANY = /\b(?:PT|CV)\.?\s+[A-Z0-9][\p{L}\p{N}&.'-]*/u;
/** A foreign legal form, in title case or ALL CAPS as board listings print them ("CO.LTD.", "SDN BHD", "S.R.O"). */
const FOREIGN_FORM = String.raw`(?:[Cc][Oo]\.?,?\s*[Ll][Tt][Dd]\.?|[Ll][Tt][Dd]\.?|[Ll]imited|LIMITED|[Ii]nc\.?|INC\.?|LLC|[Ss]\.[Rr]\.[Oo]\.?|S\.?R\.?O\.?|[Gg]mb[Hh]|GMBH|[Pp]te\.?\s*[Ll]td\.?|PTE\.?\s*LTD\.?|[Ss]dn\.?\s*[Bb]hd\.?|SDN\.?\s*BHD\.?|Group|GROUP|Company|COMPANY|Corporation|CORPORATION)`;
const FOREIGN_COMPANY = new RegExp(String.raw`\b[A-Z][\p{L}&'-]+(?:\s+[A-Z][\p{L}&'-]+)*\s+${FOREIGN_FORM}(?![\p{L}])`, "u");
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
    case "fee_asked":
      return !negatedBefore(text, start) && !coveredAfter(text, start, end);
    case "debt_bondage": {
      if (negatedBefore(text, start)) return false;
      // "gaji tidak dipotong", "no salary deductions" — the negator sits inside the match.
      return !/\b(tidak|tak|tanpa|bukan|no|not|without)\b/i.test(text.slice(start, end));
    }
    case "quick_departure":
      return !negatedBefore(text, start);
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
    case "fee_asked":
      // Every fee the model found that the ad does not say is covered.
      for (const fee of ex.fees) add(fee, !negatedBefore(text, fee.start) && !coveredAfter(text, fee.start, fee.end) && !/\b(gratis|free|ditanggung|covered)\b/i.test(fee.text));
      break;
    case "debt_bondage":
      for (const span of [...ex.fees, ...ex.promises]) add(span, PATTERNS.debt_bondage.some((re) => new RegExp(re.source, "iu").test(span.text)) && guardsPass("debt_bondage", text, span.start, span.end));
      break;
    case "quick_departure":
      for (const span of ex.promises) add(span, PATTERNS.quick_departure.some((re) => new RegExp(re.source, "iu").test(span.text)) && !negatedBefore(text, span.start));
      break;
    default:
      break;
  }
  return hits;
}

function sourceFor(id: FlagId): RuleSource | null {
  return RULE_SOURCES.flags[id] ?? null;
}

function makeFlag(id: FlagId, hits: Hit[], sourceOverride?: RuleSource | null): Flag | null {
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.span.start - b.span.start);
  const vias = new Set(hits.map((h) => h.via));
  const source = sourceOverride !== undefined ? sourceOverride : sourceFor(id);
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
  const has = (id: FlagId) => flags.some((f) => f.id === id);
  // Spans of "not a placement country" — the advisory rule does not repeat them.
  const nonPlacement = [
    ...nonPlacementMatches(adText),
    ...(extraction?.destination ? nonPlacementMatches(extraction.destination.text).map((m) => ({ ...m, span: extraction.destination as Span, model: true })) : []),
  ];
  for (const id of FLAG_ORDER) {
    let hits: Hit[];
    let source: RuleSource | null | undefined;
    if (id === "non_placement_country") {
      hits = nonPlacement.map((m) => ({ span: m.span, via: "model" in m ? ("model" as const) : ("pattern" as const) }));
      source = nonPlacement[0]?.source ?? null;
    } else if (id === "high_pay_no_experience") hits = highPayHits(adText, extraction);
    else if (id === "high_pay_light_work") hits = lightWorkHits(adText, extraction);
    else if (id === "advisory_destination") {
      hits = [...advisoryMatches(adText).map((span) => ({ span, via: "pattern" as const })), ...modelHits(id, adText, extraction)]
        .filter((h) => !nonPlacement.some((m) => m.span.start < h.span.end && h.span.start < m.span.end));
    } else if (id === "personal_recruiter") hits = personalRecruiterHits(adText, extraction);
    else if (id === "no_company") hits = has("personal_recruiter") ? [] : noCompanyHits(adText, extraction);
    // A fee already flagged as "before a contract" or "before departure" is not repeated as "a fee is asked".
    else if (id === "fee_asked") hits = has("fee_before_contract") || has("fee_before_departure") ? [] : [...patternHits(id, adText), ...modelHits(id, adText, extraction)];
    else hits = [...patternHits(id, adText), ...modelHits(id, adText, extraction)];
    const flag = makeFlag(id, dedupeHits(hits), source);
    if (flag) flags.push(flag);
  }
  // A fee that is "before departure" AND "before a contract" is the stronger NEVER flag only.
  if (has("fee_before_contract")) {
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
  if (highPaySpans(text).length === 0) return [];
  const hits: Hit[] = [];
  if (noExp.length > 0) hits.push({ span: noExp[0].span, via: "pattern" });
  if (modelNoExp.length > 0) hits.push({ span: modelNoExp[0], via: "model" });
  return hits;
}

/** Very high pay for light office work (Polri checklist item 2): the flag points at the pay. */
function lightWorkHits(text: string, ex: Extraction | null): Hit[] {
  const pay = highPaySpans(text);
  if (pay.length === 0) return [];
  const hits: Hit[] = [];
  if (new RegExp(LIGHT_WORK.source, "iu").test(text) || LIGHT_WORK_IT.test(text)) hits.push({ span: pay[0], via: "pattern" });
  if (ex?.job && (new RegExp(LIGHT_WORK.source, "iu").test(ex.job.text) || LIGHT_WORK_IT.test(ex.job.text))) hits.push({ span: pay[0], via: "model" });
  return hits;
}

/** Words that make a text read as a job offer — the no-company rule never fires on text that is not one. */
const JOB_CONTEXT = /\b(?:lowongan|loker|dibutuhkan|dicari|rekrut|direkrut|perekrutan|bekerja|pekerjaan|kerja|gaji|upah|hiring|vacanc(?:y|ies)|jobs?|work|salary)\b/iu;

/**
 * The ad names no company and gives no contact (with a personal contact, the personal-recruiter rule fires instead).
 * Only for text that reads as a job offer, and never when the model read it as something else — so a pasted recipe
 * is still "not a job ad", not a check.
 */
function noCompanyHits(text: string, ex: Extraction | null): Hit[] {
  if (!JOB_CONTEXT.test(text) || (ex && !ex.isJobOffer)) return [];
  if (LEGAL_COMPANY.test(text) || FOREIGN_COMPANY.test(text) || ex?.company) return [];
  // The flag is about the ad as a whole: it points at the ad's first line.
  const first = text.match(/^\s*([^\n]{1,80})/u);
  if (!first) return [];
  const start = (first.index ?? 0) + first[0].length - first[1].length;
  const span = { text: first[1], start, end: start + first[1].length };
  return ex ? [{ span, via: "pattern" }, { span, via: "model" }] : [{ span, via: "pattern" }];
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
