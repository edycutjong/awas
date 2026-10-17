/**
 * Name masking and phone sanitising.
 *
 * Awas never accuses anyone in its own words: the ad's company may appear only inside a quote the gate verified, or in
 * the attribution string. Everywhere else — the claim ("Awas's reading"), the English gloss, every dropped quote and
 * the model's own sentences in the family message — code replaces the company name and the ad's phone digits.
 * `sanitise()` runs before every write: phone digits are masked except the last 4 in the stored ad text, the extracted
 * phones, the stored Tavily parameters and every flag excerpt (`flags[].span.text`). Masking runs after the rubric and the
 * verdict: the rubric reads the raw ad, only the copy that leaves the function is masked ("•" keeps each span's length, so
 * offsets stay valid).
 */

import { companyTokens } from "./rubric";
import { digits, escapeRegExp } from "./text";
import type { EvidencePack, Flag } from "./types";

export const MASK = {
  company: { id: "[perusahaan dalam iklan]", en: "[the company in the ad]" },
  phone: { id: "[nomor dalam iklan]", en: "[the number in the ad]" },
};

/** A regex for the company name with flexible spacing/punctuation between its tokens ("PT. Maju  Jaya" = "PT Maju Jaya"). */
export function companyPattern(company: string): RegExp | null {
  const tokens = companyTokens(company);
  if (tokens.length === 0) return null;
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${tokens.map(escapeRegExp).join(String.raw`[\s.,'’-]*`)}(?![\p{L}\p{N}])`, "giu");
}

export function mentionsCompany(text: string, company: string | undefined): boolean {
  if (!company) return false;
  const re = companyPattern(company);
  return !!re && re.test(text);
}

export function maskCompany(text: string, company: string | undefined, lang: "id" | "en"): string {
  if (!company) return text;
  const re = companyPattern(company);
  return re ? text.replace(re, MASK.company[lang]) : text;
}

/** Replace any number whose digits contain an ad phone's last 9 digits. */
export function maskAdPhones(text: string, phones: string[], lang: "id" | "en"): string {
  const last9s = phones.map((p) => digits(p).slice(-9)).filter((d) => d.length === 9);
  if (last9s.length === 0) return text;
  return text.replace(/\+?\d[\d\s.-]{6,}\d/g, (m) => (last9s.some((l) => digits(m).includes(l)) ? MASK.phone[lang] : m));
}

export function maskAll(text: string, company: string | undefined, phones: string[], lang: "id" | "en"): string {
  return maskAdPhones(maskCompany(text, company, lang), phones, lang);
}

/** A phone-number-like run: Indonesian mobile formats and +country formats, with spaces, dots or hyphens. */
const PHONE_RUN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?0?8\d{1,3}\)?|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,5}/g;

/** Mask every digit of a phone-number-like run except its last 4: "0812-3456-7890" → "••••-••••-7890". */
export function maskPhoneDigits(text: string): string {
  return text.replace(PHONE_RUN, (m) => {
    if (digits(m).length < 9) return m;
    let keep = 4;
    const chars = m.split("");
    for (let i = chars.length - 1; i >= 0; i--) {
      if (/\d/.test(chars[i])) {
        if (keep > 0) keep--;
        else chars[i] = "•";
      }
    }
    return chars.join("");
  });
}

/** The flags with phone digits masked in each excerpt; id, class, via, offsets and everything else are untouched. */
export function maskFlags(flags: Flag[]): Flag[] {
  return flags.map((f) => ({ ...f, span: { ...f.span, text: maskPhoneDigits(f.span.text) } }));
}

/** Runs before EVERY write of a pack. */
export function sanitise(pack: EvidencePack): EvidencePack {
  const ex = pack.extraction;
  return {
    ...pack,
    adTextMasked: maskPhoneDigits(pack.adTextMasked),
    flags: maskFlags(pack.flags ?? []),
    extraction: ex ? { ...ex, phones: ex.phones.map((p) => ({ ...p, text: maskPhoneDigits(p.text) })) } : ex,
    tavily: pack.tavily.map((t) => ({
      ...t,
      params: Object.fromEntries(Object.entries(t.params).map(([k, v]) => [k, typeof v === "string" ? maskPhoneDigits(v) : v])),
    })),
  };
}

/** Case IDs: 128-bit random, base32 (lowercase, no padding). */
export function newCaseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
