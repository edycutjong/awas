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

  it("fires the not-a-placement-country rule for Cambodia (not the advisory rule twice) and the high-pay flags", () => {
    const got = ids(MOCK_AD);
    expect(got).toContain("non_placement_country");
    expect(got).not.toContain("advisory_destination");
    expect(got).toContain("high_pay_no_experience");
    expect(got).toContain("high_pay_light_work");
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

describe("Amendment 4 — the Polri checklist items, the Kemnaker fee rule and the non-placement countries", () => {
  it("Cambodia and Myanmar are NEVER (each with its own KP2MI statement); Thailand stays an advisory CAUTION", () => {
    const kh = evaluateRubric("Lowongan CS di Phnom Penh, gaji 1.000 USD", null).find((f) => f.id === "non_placement_country");
    expect(kh).toMatchObject({ class: "NEVER", sourced: true });
    expect(kh?.source?.quote).toContain("Kamboja itu bukan negara penempatan");
    const mm = evaluateRubric("Kerja di Myanmar bagian marketing", null).find((f) => f.id === "non_placement_country");
    expect(mm?.source?.quote).toContain("Myanmar bukan negara penempatan resmi");
    const th = evaluateRubric("Kerja di Thailand bagian marketing", null);
    expect(th.map((f) => f.id)).toContain("advisory_destination");
    expect(th.map((f) => f.id)).not.toContain("non_placement_country");
  });

  it("a negated mention of Cambodia is not an offer to go there", () => {
    for (const t of ["Penempatan Malaysia, bukan ke Kamboja", "Job in Japan, not in Cambodia", "tidak ke Myanmar"]) {
      expect(ids(t)).not.toContain("non_placement_country");
    }
  });

  it("fires from the model's destination field", () => {
    const ad = "Negara: Kamboja (Sihanoukville). Posisi admin.";
    const ex: Extraction = { isJobOffer: true, phones: [], fees: [], promises: [], droppedFields: [], destination: { text: "Kamboja (Sihanoukville)", start: 8, end: 31 } };
    expect(evaluateRubric(ad, ex).find((f) => f.id === "non_placement_country")?.via).toBe("both");
  });

  it("a fee asked to get the job is CAUTION, in Indonesian and English; never the pay, never a covered cost", () => {
    for (const t of ["Biaya pendaftaran Rp 500 ribu", "harus menyetorkan uang Rp 12 juta per orang", "Rp 3 juta untuk biaya proses visa", "meminta sejumlah uang untuk mengurus dokumen", "A registration fee of USD 300", "You must pay a processing fee"]) {
      const f = evaluateRubric(t, null).find((x) => x.id === "fee_asked");
      expect(f, t).toMatchObject({ class: "CAUTION", sourced: true });
    }
    for (const t of ["Gaji Rp 8 juta per bulan", "Bebas biaya, gaji Rp 9 juta", "Biaya pelatihan gratis, gaji Rp 9 juta", "Biaya Rp 0", "Basic pay USD 900 per month"]) {
      expect(ids(t), t).not.toContain("fee_asked");
    }
  });

  it("a fee already flagged before a contract or before departure is not repeated", () => {
    const got = ids("Biaya admin Rp 3 jt sebelum berangkat");
    expect(got).toContain("fee_before_departure");
    expect(got).not.toContain("fee_asked");
  });

  it("costs advanced and deducted from pay (item 5); not when the ad says there is no deduction", () => {
    for (const t of ["Biaya keberangkatan ditalangi dulu", "nanti dipotong dari gaji", "gaji akan dipotong selama tiga bulan", "ada dana talangan", "Costs are deducted from your salary"]) {
      expect(ids(t), t).toContain("debt_bondage");
    }
    for (const t of ["Tanpa potongan gaji", "Gaji tidak dipotong", "No salary deductions"]) {
      expect(ids(t), t).not.toContain("debt_bondage");
    }
  });

  it("a very fast departure with no selection or training (item 1)", () => {
    for (const t of ["Proses cepat, langsung berangkat", "berangkat dalam 7 hari", "tanpa tes dan tanpa pelatihan", "Fast departure guaranteed", "Fly within 2 weeks"]) {
      expect(ids(t), t).toContain("quick_departure");
    }
    expect(ids("Tidak langsung berangkat: pelatihan 3 bulan di LPK resmi")).not.toContain("quick_departure");
  });

  it("very high pay for light office work (item 2) needs both the pay and the light work", () => {
    expect(ids("Dicari admin online di Malaysia, gaji Rp 12 juta")).toContain("high_pay_light_work");
    expect(ids("Customer service, high salary")).toContain("high_pay_light_work");
    expect(ids("Dicari admin online di Malaysia, gaji Rp 4 juta")).not.toContain("high_pay_light_work");
    expect(ids("Operator produksi pabrik di Jepang, gaji Rp 15 juta")).not.toContain("high_pay_light_work");
  });

  it("the ad names no company and no contact (item 3) — only for a job offer", () => {
    expect(ids("Lowongan kerja di Malaysia, gaji besar")).toContain("no_company");
    expect(ids("Lowongan kerja di Malaysia, hubungi WA admin")).toContain("personal_recruiter");
    expect(ids("Lowongan kerja di Malaysia, hubungi WA admin")).not.toContain("no_company");
    expect(ids("Lowongan PT Maju Terus di Malaysia")).not.toContain("no_company");
    // Board listings print foreign legal forms in capitals.
    for (const t of ["Worker\nHJ INTERNATIONAL CO. LTD. Taiwan\nGaji :", "Worker\nACROOS BORDERLAND CONSULTING S.R.O Slovakia\nGaji :", "Plantation Worker\nPAMOL PLANTATIONS SDN BHD Malaysia\nGaji :"]) {
      expect(ids(t), t).not.toContain("no_company");
    }
    expect(ids("Resep sambal matah: bawang merah, cabai rawit, serai")).not.toContain("no_company");
    expect(ids("Info kerja bakti warga hari Minggu")).not.toContain("no_company");
    // The model's "not a job offer" reading never switches a raw-text rule off (tranche 1, row t1-p11).
    const notAnOffer: Extraction = { isJobOffer: false, phones: [], fees: [], promises: [], droppedFields: [] };
    expect(evaluateRubric("Korban ditawari pekerjaan di Malaysia dengan gaji Rp 9 juta", notAnOffer).map((f) => f.id)).toContain("no_company");
  });

  it("narrative words of a news report alone fire nothing (the rules read offers, not reports)", () => {
    expect(ids("Korban dijanjikan dan diiming-imingi, lalu tergiur. Modusnya menipu korban.")).toEqual([]);
  });
});

describe("a kind of recruiter is not a company name (tranche 1, row t1-p16)", () => {
  it("drops 'Lembaga Pelatihan Kerja (LPK)' and 'CPMI non-prosedural', keeps real names", async () => {
    const { toExtraction, isGenericRecruiter } = await import("@/lib/extract");
    expect(isGenericRecruiter("Lembaga Pelatihan Kerja (LPK)")).toBe(true);
    expect(isGenericRecruiter("CPMI non-prosedural")).toBe(true);
    expect(isGenericRecruiter("PT Samudera Perdana Selaras")).toBe(false);
    expect(isGenericRecruiter("TRIAS INSAN MADANI")).toBe(false);
    const ad = "Korban dijanjikan bekerja sebagai waitress di Bahrain melalui Lembaga Pelatihan Kerja (LPK) di Lampung.";
    const raw = { is_job_offer: true, company: "Lembaga Pelatihan Kerja (LPK)", recruiter: null, phones: [], destination: "Bahrain", job: "waitress", visa: null, fees: [], promises: [] };
    const ex = toExtraction(ad, raw);
    expect(ex.company).toBeUndefined();
    expect(ex.droppedFields).toContain("company (not a name)");
    expect(evaluateRubric(ad, ex).map((f) => f.id)).toContain("no_company");
  });
});
