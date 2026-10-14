import { describe, expect, it } from "vitest";
import { evaluateRubric, negatedBefore, payFigures } from "@/lib/rubric";
import { RULE_SOURCES } from "@/lib/rule-sources";
import type { Extraction, FlagId } from "@/lib/types";

const ids = (text: string, ex: Extraction | null = null): FlagId[] => evaluateRubric(text, ex).map((f) => f.id);

/** The composite ad of the design mockup (assets/ui/mock.html) — not a real ad. */
const MOCK_AD =
  "Dibutuhkan CS online untuk Kamboja. Gaji Rp 15 jt/bulan, tanpa pengalaman.\nVisa turis diurus, tiket ditanggung. Biaya admin Rp 3 jt sebelum berangkat.";

describe("the mockup ad", () => {
  it("fires the tourist-visa flag through the regex alone (no model)", () => {
    const flag = evaluateRubric(MOCK_AD, null).find((f) => f.id === "tourist_visa");
    expect(flag?.via).toBe("pattern");
    expect(flag?.span.text).toBe("Visa turis");
  });

  it("fires fee-before-departure (CAUTION) but not fee-before-contract", () => {
    const got = ids(MOCK_AD);
    expect(got).toContain("fee_before_departure");
    expect(got).not.toContain("fee_before_contract");
  });

  it("fires the advisory destination and high-pay flags", () => {
    const got = ids(MOCK_AD);
    expect(got).toContain("advisory_destination");
    expect(got).toContain("high_pay_no_experience");
  });

  it("every NEVER rule has a recorded official source, so it can STOP on its own", () => {
    for (const f of evaluateRubric(MOCK_AD, null).filter((f) => f.id === "tourist_visa")) expect(f).toMatchObject({ class: "NEVER", sourced: true });
    expect(RULE_SOURCES.flags.fee_before_contract?.domain).toBe("kemnaker.go.id");
    expect(RULE_SOURCES.flags.passport_retention?.domain).toBe("humas.polri.go.id");
  });
});

describe("W1 false-positive rows (submission/a2a round 2) never fire a NEVER rule", () => {
  const never: FlagId[] = ["tourist_visa", "fee_before_contract", "passport_retention"];
  for (const text of [
    "Valid passport holders only",
    "Salary includes basic pay before overtime",
    "No placement fee before contract signing",
    "No tourist visas — work permit only",
    "Semua biaya ditanggung perusahaan sebelum berangkat",
  ]) {
    it(text, () => {
      const got = ids(text);
      for (const id of never) expect(got).not.toContain(id);
    });
  }

  it("'Visit visa holders may apply' is VERIFY FIRST material, not a NEVER flag", () => {
    const got = evaluateRubric("Visit visa holders may apply. Dubai, salary AED 3000.", null);
    expect(got.map((f) => f.id)).toContain("visit_visa_holder");
    expect(got.find((f) => f.id === "visit_visa_holder")?.class).toBe("CAUTION");
    expect(got.map((f) => f.id)).not.toContain("tourist_visa");
  });

  it("'Semua biaya ditanggung perusahaan sebelum berangkat' fires no fee flag at all", () => {
    expect(ids("Semua biaya ditanggung perusahaan sebelum berangkat")).not.toContain("fee_before_departure");
  });
});

describe("tourist visa", () => {
  it("fires on Indonesian and English wording", () => {
    for (const t of ["Berangkat pakai visa kunjungan, diurus agen", "visa wisata 30 hari", "We arrange your tourist visa", "Entry on a visit visa, converted later"]) {
      expect(ids(t)).toContain("tourist_visa");
    }
  });

  it("does not fire when a negator governs the phrase", () => {
    for (const t of ["bukan visa turis", "tanpa visa turis", "tidak pakai visa turis, visa kerja resmi", "This is not a tourist visa job"]) {
      expect(ids(t)).not.toContain("tourist_visa");
    }
  });

  it("the negation guard never reaches across clause punctuation", () => {
    expect(ids("Tanpa pengalaman. Visa turis diurus")).toContain("tourist_visa");
    expect(ids("Tanpa pengalaman, visa turis diurus")).toContain("tourist_visa");
    expect(ids("tanpa pengalaman visa turis diurus")).toContain("tourist_visa");
  });

  it("'visa turis ditanggung perusahaan' still fires — covered costs do not cancel a tourist visa for work", () => {
    expect(ids("Visa turis ditanggung perusahaan")).toContain("tourist_visa");
  });

  it("fires from the model's visa field too (via both when the regex agrees)", () => {
    const ad = "Kerja di Kamboja. Visa: turis, diurus";
    const ex: Extraction = { isJobOffer: true, phones: [], fees: [], promises: [], droppedFields: [], visa: { text: "Visa: turis", start: ad.indexOf("Visa:"), end: ad.indexOf("Visa:") + 11 } };
    const flag = evaluateRubric(ad, ex).find((f) => f.id === "tourist_visa");
    expect(flag?.via).toBe("model");
  });

  it("is NEVER only with a recorded official source; otherwise drawn as CAUTION", () => {
    const flag = evaluateRubric("visa turis diurus", null).find((f) => f.id === "tourist_visa");
    expect(flag?.class).toBe(flag?.sourced ? "NEVER" : "CAUTION");
    expect(flag?.sourced).toBe(!!RULE_SOURCES.flags.tourist_visa);
  });
});

describe("fee before a contract (NEVER) vs before departure (CAUTION)", () => {
  it("fires only when the clause mentions a contract, signing, DP or uang jaminan", () => {
    expect(ids("Biaya Rp 5 juta dibayar sebelum tanda tangan kontrak")).toContain("fee_before_contract");
    expect(ids("Bayar DP dulu: biaya proses Rp 2 juta sebelum kontrak")).toContain("fee_before_contract");
    expect(ids("Uang jaminan Rp 3 juta dibayar dulu")).toContain("fee_before_contract");
    expect(ids("A processing fee of $300 before contract signing")).toContain("fee_before_contract");
  });

  it("'jaminan' alone (a benefits list) never counts", () => {
    expect(ids("Biaya pelatihan dibayar dulu. Fasilitas: jaminan sosial, asrama")).not.toContain("fee_before_contract");
  });

  it("fee before departure alone is the CAUTION flag", () => {
    expect(ids("biaya administrasi Rp 2 jt sebelum berangkat")).toContain("fee_before_departure");
    expect(ids("A fee of USD 500 before departure")).toContain("fee_before_departure");
    expect(evaluateRubric("biaya administrasi Rp 2 jt sebelum berangkat", null).find((f) => f.id === "fee_before_departure")?.class).toBe("CAUTION");
  });

  it("never fires on bare 'pay'", () => {
    expect(ids("Basic pay before deductions is USD 900")).not.toContain("fee_before_departure");
    expect(ids("Basic pay before deductions is USD 900")).not.toContain("fee_before_contract");
  });

  it("is cancelled by 'tanpa biaya' and by covered costs, but not by costs the worker bears", () => {
    expect(ids("Tanpa biaya apa pun sebelum berangkat")).not.toContain("fee_before_departure");
    expect(ids("Biaya Rp 0 sebelum berangkat")).not.toContain("fee_before_departure");
    expect(ids("Biaya medis ditanggung pekerja sebelum berangkat")).toContain("fee_before_departure");
  });
});

describe("passport retention — retention forms only", () => {
  it("fires on retention wording", () => {
    for (const t of ["Paspor diserahkan ke kantor selama kontrak", "paspor akan ditahan agen", "Your passport will be kept by the company", "We hold your passport for safety"]) {
      expect(ids(t)).toContain("passport_retention");
    }
  });

  it("does not fire on 'holder', on negated retention, or on keeping your own passport", () => {
    for (const t of ["Valid passport holders only", "Paspor tidak akan ditahan", "Your passport will not be held", "Keep your own passport", "paspor dipegang sendiri oleh pekerja", "We never hold your passport"]) {
      expect(ids(t)).not.toContain("passport_retention");
    }
  });
});

describe("personal recruiter", () => {
  it("fires on a contact with no company named", () => {
    expect(ids("Minat? Hubungi [nomor] via WA")).toContain("personal_recruiter");
    expect(ids("Info lanjut chat WhatsApp 0812-3456-7890")).toContain("personal_recruiter");
  });

  it("does not fire when a company is named", () => {
    expect(ids("PT Maju Bersama membuka lowongan. Hubungi WA kantor")).not.toContain("personal_recruiter");
    expect(ids("Kelly Group Ltd hiring, WhatsApp us")).not.toContain("personal_recruiter");
  });
});

describe("pay figures", () => {
  it("reads rupiah in its common written forms and dollars", () => {
    const v = (t: string) => payFigures(t).map((p) => `${p.amount} ${p.currency}`);
    expect(v("Gaji Rp 15 jt/bulan")).toEqual(["15000000 IDR"]);
    expect(v("gaji Rp12.800.000 per bulan")).toEqual(["12800000 IDR"]);
    expect(v("gaji 9,5 juta")).toEqual(["9500000 IDR"]);
    expect(v("salary USD 1,000 a month")).toEqual(["1000 USD"]);
  });

  it("high pay is judged against the two cited figures (Rp 6 juta, USD 700), never converted", () => {
    expect(ids("Tanpa pengalaman, gaji Rp 6 juta per bulan")).toContain("high_pay_no_experience");
    expect(ids("Tanpa pengalaman, gaji Rp 5 juta per bulan")).not.toContain("high_pay_no_experience");
    expect(ids("No experience needed, salary USD 800")).toContain("high_pay_no_experience");
    expect(ids("No experience needed, salary USD 500")).not.toContain("high_pay_no_experience");
    expect(ids("Gaji Rp 15 juta, pengalaman minimal 2 tahun")).not.toContain("high_pay_no_experience");
  });
});

describe("negatedBefore", () => {
  it("accepts one filler word between the negator and the phrase", () => {
    const t = "tidak perlu visa turis";
    expect(negatedBefore(t, t.indexOf("visa"))).toBe(true);
    const u = "tidak perlu pengalaman visa turis";
    expect(negatedBefore(u, u.indexOf("visa"))).toBe(false);
  });
});
