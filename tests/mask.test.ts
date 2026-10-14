import { describe, expect, it } from "vitest";
import { maskAdPhones, maskCompany, maskPhoneDigits, mentionsCompany, newCaseId, sanitise } from "@/lib/mask";
import type { EvidencePack } from "@/lib/types";

describe("company masking", () => {
  it("replaces the company with flexible spacing and legal-form punctuation", () => {
    expect(maskCompany("Laporan: PT. Sinar  Harapan Abadi merekrut korban", "PT Sinar Harapan Abadi", "en")).toBe("Laporan: [the company in the ad] merekrut korban");
    expect(maskCompany("pt sinar harapan abadi", "PT Sinar Harapan Abadi", "id")).toBe("[perusahaan dalam iklan]");
  });

  it("does not mask a different word that merely starts with the name", () => {
    expect(mentionsCompany("PT Sinar Harapan Abadinya", "PT Sinar Harapan Abadi")).toBe(false);
  });
});

describe("phone masking", () => {
  it("masks the ad's own numbers by their last 9 digits", () => {
    expect(maskAdPhones("Hubungi 0812-3456-7890 sekarang", ["+62 812 3456 7890"], "id")).toBe("Hubungi [nomor dalam iklan] sekarang");
  });

  it("sanitise keeps only the last 4 digits of phone-like runs", () => {
    expect(maskPhoneDigits("WA 0812-3456-7890 atau +62 812 3456 7890")).toBe("WA ••••-••••-7890 atau +•• ••• •••• 7890");
    expect(maskPhoneDigits("Gaji Rp 15.000.000")).toBe("Gaji Rp 15.000.000");
  });

  it("sanitise runs over the ad text, extracted phones and Tavily params", () => {
    const pack = {
      adTextMasked: "WA 081234567890",
      extraction: { isJobOffer: true, phones: [{ text: "081234567890", start: 3, end: 15 }], fees: [], promises: [], droppedFields: [] },
      tavily: [{ method: "search", purpose: "phone", params: { query: '"081234567890"', max_results: 5 }, credits: 1, ms: 1, urls: [], access: "key" }],
    } as unknown as EvidencePack;
    const s = sanitise(pack);
    expect(s.adTextMasked).toBe("WA ••••••••7890");
    expect(s.extraction?.phones[0].text).toBe("••••••••7890");
    expect(s.tavily[0].params.query).toBe('"••••••••7890"');
    expect(s.tavily[0].params.max_results).toBe(5);
  });
});

describe("case ids", () => {
  it("are 128-bit base32", () => {
    const id = newCaseId();
    expect(id).toMatch(/^[a-z2-7]{26}$/);
    expect(newCaseId()).not.toBe(id);
  });
});
