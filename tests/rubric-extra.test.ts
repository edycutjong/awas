/**
 * Rubric branches the main suite does not reach: two-token negators, a negated non-placement country, the model's
 * fee / promise readings, both fee flags at once, spans without an index, and flags whose rule has no source.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRubric, negatedBefore } from "@/lib/rubric";
import { RULE_SOURCES } from "@/lib/rule-sources";
import type { Extraction, FlagId, Span } from "@/lib/types";

afterEach(() => vi.restoreAllMocks());

const sp = (ad: string, piece: string): Span => {
  const start = ad.indexOf(piece);
  if (start < 0) throw new Error(`fixture: ${piece} not in ad`);
  return { text: piece, start, end: start + piece.length };
};
const ex = (ad: string, o: { fees?: string[]; promises?: string[]; job?: string; destination?: string; visa?: string; company?: string; phones?: string[] } = {}): Extraction => ({
  isJobOffer: true,
  company: o.company ? sp(ad, o.company) : undefined,
  phones: (o.phones ?? []).map((p) => sp(ad, p)),
  job: o.job ? sp(ad, o.job) : undefined,
  destination: o.destination ? sp(ad, o.destination) : undefined,
  visa: o.visa ? sp(ad, o.visa) : undefined,
  fees: (o.fees ?? []).map((f) => sp(ad, f)),
  promises: (o.promises ?? []).map((f) => sp(ad, f)),
  droppedFields: [],
});
const ids = (ad: string, e: Extraction | null = null): FlagId[] => evaluateRubric(ad, e).map((f) => f.id);
const vias = (ad: string, e: Extraction | null, id: FlagId) => evaluateRubric(ad, e).find((f) => f.id === id)?.via;

/** String.prototype.matchAll / match whose results carry no `.index` (the `?? 0` fallbacks). */
function stripIndexes() {
  const matchAll = String.prototype.matchAll;
  const match = String.prototype.match;
  vi.spyOn(String.prototype, "matchAll").mockImplementation(function (this: string, re: RegExp) {
    return [...matchAll.call(String(this), re)].map((m) => [...m] as unknown as RegExpMatchArray)[Symbol.iterator]();
  } as typeof String.prototype.matchAll);
  vi.spyOn(String.prototype, "match").mockImplementation(function (this: string, re: string | RegExp) {
    const r = match.call(String(this), re as RegExp);
    return r && !r.groups && !(re as RegExp).global ? ([...r] as unknown as RegExpMatchArray) : r;
  } as typeof String.prototype.match);
}

describe("negation", () => {
  it("a two-token negator ('free of') negates the phrase after it; a lone non-negator does not", () => {
    expect(negatedBefore("Kami free of visa turis", 13)).toBe(true);
    expect(negatedBefore("Kami do not pakai visa turis", 18)).toBe(true);
    expect(negatedBefore("kerja visa turis", 6)).toBe(false);
    expect(negatedBefore("visa turis", 0)).toBe(false);
  });
  it("a country straight after a negator is not a placement-country mention", () => {
    expect(ids("Lowongan kerja tidak Kamboja, gaji kecil")).not.toContain("non_placement_country");
    expect(ids("Lowongan kerja ke Kamboja, gaji kecil")).toContain("non_placement_country");
  });
});

describe("the model's fee and promise readings", () => {
  const contractAd = "Peserta wajib bayar biaya 3 juta dulu sebelum tanda tangan kontrak kerja.";
  it("fee before contract: needs a 'before' word, a contract word, no negation, no cover", () => {
    expect(vias(contractAd, ex(contractAd, { fees: ["biaya 3 juta"] }), "fee_before_contract")).toBe("both");
    const noBefore = "Peserta wajib bayar biaya 3 juta untuk kontrak kerja.";
    expect(ids(noBefore, ex(noBefore, { fees: ["biaya 3 juta"] }))).not.toContain("fee_before_contract");
    const noKind = "Peserta wajib bayar biaya 3 juta dulu sebelum penempatan.";
    expect(ids(noKind, ex(noKind, { fees: ["biaya 3 juta"] }))).not.toContain("fee_before_contract");
    const negated = "Peserta tanpa biaya 3 juta dulu sebelum tanda tangan kontrak kerja.";
    expect(ids(negated, ex(negated, { fees: ["biaya 3 juta"] }))).not.toContain("fee_before_contract");
    const covered = "Peserta biaya 3 juta ditanggung dulu sebelum tanda tangan kontrak kerja.";
    expect(ids(covered, ex(covered, { fees: ["biaya 3 juta"] }))).not.toContain("fee_before_contract");
  });
  it("fee before departure from the model alone", () => {
    const ad = "Calon pekerja membayar biaya 2 juta sebelum berangkat ke Taiwan.";
    expect(vias(ad, ex(ad, { fees: ["biaya 2 juta"] }), "fee_before_departure")).toBe("both");
  });
  it("quick departure from a model promise needs a matching, non-negated promise", () => {
    const ad = "Langsung berangkat minggu depan. Tidak perlu tes. Tanpa langsung berangkat.";
    expect(ids(ad, ex(ad, { promises: ["Langsung berangkat", "Tidak perlu tes"] }))).toContain("quick_departure");
    const notMatching = "Kami bagus sekali dan ramah semua.";
    expect(ids(notMatching, ex(notMatching, { promises: ["bagus sekali"] }))).not.toContain("quick_departure");
    const negated = "Tanpa langsung berangkat.";
    expect(vias(negated, ex(negated, { promises: ["langsung berangkat"] }), "quick_departure")).toBeUndefined();
  });
  it("high pay with no experience from a model promise alone", () => {
    const ad = "Gaji Rp 25.000.000 per bulan. Tidak perlu pengalaman sama sekali. Kerja admin.";
    expect(ids(ad, ex(ad, { promises: ["Tidak perlu pengalaman"] }))).toContain("high_pay_no_experience");
    const modelOnly = "Gaji Rp 25.000.000 per bulan. Semua orang boleh melamar, kerja mudah.";
    expect(ids(modelOnly, ex(modelOnly, { promises: ["Semua orang boleh melamar"] }))).not.toContain("high_pay_no_experience");
  });
  it("model-only no-experience hit when the raw text has no such phrase", () => {
    const ad = "Gaji Rp 25.000.000 per bulan. Kerja mudah sekali.";
    const e = ex(ad, { promises: ["Kerja mudah sekali"] });
    expect(vias(ad, e, "high_pay_no_experience")).toBeUndefined();
    // A model promise whose wording is the no-experience rule, when the raw text itself has no such phrase.
    const detached: Extraction = { ...e, promises: [{ text: "tanpa pengalaman", start: 0, end: 16 }] };
    expect(vias(ad, detached, "high_pay_no_experience")).toBe("model");
  });
});

describe("both fee flags", () => {
  it("fee-before-contract suppresses an overlapping fee-before-departure, keeps a separate one", () => {
    const one = "Biaya admin sebelum berangkat tanda tangan kontrak.";
    const got = ids(one);
    expect(got).toContain("fee_before_contract");
    expect(got).not.toContain("fee_before_departure");
    const two = "Biaya admin dulu untuk tanda tangan kontrak. Semua tentu saja menyenangkan sekali. Biaya admin sebelum berangkat nanti.";
    const both = ids(two);
    expect(both).toContain("fee_before_contract");
    expect(both).toContain("fee_before_departure");
  });
});

describe("a rule whose source is missing", () => {
  it("is still reported, as an unsourced CAUTION", () => {
    const flags = RULE_SOURCES.flags as Record<string, unknown>;
    const saved = flags.tourist_visa;
    delete flags.tourist_visa;
    try {
      const f = evaluateRubric("Visa turis diurus.", null).find((x) => x.id === "tourist_visa");
      expect(f).toMatchObject({ sourced: false, class: "CAUTION", source: null });
    } finally {
      flags.tourist_visa = saved;
    }
  });
});

describe("no-company rule on odd text", () => {
  it("handles an ad whose first line cannot be read, and a match without an index", () => {
    const ad = "Dibutuhkan staf admin tanpa nama perusahaan";
    const real = String.prototype.match;
    vi.spyOn(String.prototype, "match").mockImplementation(function (this: string, re: string | RegExp) {
      if (re instanceof RegExp && re.source.startsWith("^\\s*(")) return null;
      return real.call(String(this), re as RegExp);
    } as typeof String.prototype.match);
    expect(ids(ad)).not.toContain("no_company");
    vi.restoreAllMocks();
    vi.spyOn(String.prototype, "match").mockImplementation(function (this: string, re: string | RegExp) {
      const r = real.call(String(this), re as RegExp);
      if (re instanceof RegExp && re.source.startsWith("^\\s*(") && r) return [...r] as unknown as RegExpMatchArray;
      return r;
    } as typeof String.prototype.match);
    expect(ids("Dibutuhkan staf admin tanpa nama perusahaan")).toContain("no_company");
  });
  it("runs the whole rubric on a rich ad when match results have no index", () => {
    stripIndexes();
    const ad = "Dibutuhkan CS online ke Kamboja dan Myanmar. Gaji Rp 15 jt/bulan, belasan juta, tanpa pengalaman. Visa turis. Biaya admin Rp 3 jt sebelum berangkat. Hubungi 0812-3456-7890. Kirim CV ke WA. PT Maju Jaya. Cuma US$ 2000 gaji.";
    expect(evaluateRubric(ad, null).length).toBeGreaterThan(0);
    expect(ids("Dibutuhkan staf. Hubungi 0812-3456-7890")).toContain("personal_recruiter");
  });
});
