/**
 * extract.ts branches: validation shapes, locate() with taken spans / normalised fallbacks, list fields with junk,
 * and extractFields when the model call fails (chat is replaced so every outcome shape can be produced).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOutcome } from "@/lib/tf";

const chatMock = vi.fn<(...a: unknown[]) => Promise<ChatOutcome>>();
vi.mock("@/lib/tf", async (orig) => ({ ...(await orig<typeof import("@/lib/tf")>()), chat: (...a: unknown[]) => chatMock(...a) }));

import { extractFields, isGenericRecruiter, locate, toExtraction, validateExtraction } from "@/lib/extract";

const receipt = { call: "extract" as const, model: "m", promptTokens: 1, completionTokens: 1, reasoningTokens: null, ms: 1, format: "json_object", attempts: 1 };
const tf = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "m", propose: "m", message: "m" } };

beforeEach(() => chatMock.mockReset());

describe("validateExtraction", () => {
  it("rejects non-objects, arrays and null", () => {
    expect(validateExtraction(null)).toBe("not an object");
    expect(validateExtraction("x")).toBe("not an object");
    expect(validateExtraction([])).toBe("not an object");
  });
  it("requires a boolean is_job_offer, string-or-null scalars and string-list lists", () => {
    expect(validateExtraction({ is_job_offer: "yes" })).toMatch(/is_job_offer/);
    expect(validateExtraction({ is_job_offer: true, company: 3 })).toBe("company is not a string or null");
    expect(validateExtraction({ is_job_offer: true, company: null, job: undefined, visa: "x" })).toBeNull();
    expect(validateExtraction({ is_job_offer: true, phones: "081" })).toBe("phones is not a list of strings");
    expect(validateExtraction({ is_job_offer: true, fees: [1] })).toBe("fees is not a list of strings");
    expect(validateExtraction({ is_job_offer: true, promises: null, fees: undefined, phones: ["081"] })).toBeNull();
  });
});

describe("locate", () => {
  it("returns null for an empty piece and for a piece that is not in the ad", () => {
    expect(locate("abc", "   ")).toBeNull();
    expect(locate("abc", "zzz")).toBeNull();
    expect(locate("abc", "***")).toBeNull();
  });
  it("skips spans already taken, exact and normalised, and moves on to the next occurrence", () => {
    const ad = "Gaji 5 juta. Gaji 5 juta lagi";
    const first = locate(ad, "Gaji 5 juta")!;
    expect(first.start).toBe(0);
    const second = locate(ad, "Gaji 5 juta", [first])!;
    expect(second.start).toBe(13);
    expect(locate(ad, "Gaji 5 juta", [first, second])).toBeNull();
    const fancy = "Kirim “CV” sekarang. Kirim “CV” lagi";
    const a = locate(fancy, 'kirim "cv"')!;
    const b = locate(fancy, 'kirim "cv"', [a])!;
    expect(b.start).toBeGreaterThan(a.start);
    expect(locate(fancy, 'kirim "cv"', [a, b])).toBeNull();
  });
});

describe("isGenericRecruiter / toExtraction", () => {
  it("a name with no word tokens is not a generic recruiter", () => {
    expect(isGenericRecruiter("!!!")).toBe(false);
    expect(isGenericRecruiter("Lembaga Pelatihan Kerja")).toBe(true);
  });
  it("ignores non-string and blank list entries and a missing list, dropping unlocatable ones by name", () => {
    const e = toExtraction("Hubungi 081234567890 untuk kerja", {
      is_job_offer: true, company: null, recruiter: null, destination: null, job: null, visa: null,
      phones: [5 as unknown as string, "  ", "081234567890", "999"], fees: undefined as unknown as string[], promises: [],
    });
    expect(e.phones.map((p) => p.text)).toEqual(["081234567890"]);
    expect(e.droppedFields).toEqual(["phones"]);
    expect(e.fees).toEqual([]);
  });
});

describe("extractFields", () => {
  it("returns the located extraction and the receipt when the call succeeds", async () => {
    chatMock.mockResolvedValue({ ok: true, content: "{}", value: { is_job_offer: true, company: "PT Maju" }, receipt, error: null });
    const out = await extractFields(tf, "Lowongan PT Maju", undefined, 123);
    expect(out.error).toBeNull();
    expect(out.extraction?.company?.text).toBe("PT Maju");
  });
  it("reports the call's own error when it failed", async () => {
    chatMock.mockResolvedValue({ ok: false, content: null, value: null, receipt, error: "boom" });
    expect(await extractFields(tf, "x")).toEqual({ extraction: null, receipt, error: "boom" });
  });
  it("says 'extraction failed' when it failed without a message, or returned no value", async () => {
    chatMock.mockResolvedValue({ ok: false, content: null, value: null, receipt, error: null });
    expect((await extractFields(tf, "x")).error).toBe("extraction failed");
    chatMock.mockResolvedValue({ ok: true, content: "t", value: null, receipt, error: null });
    expect((await extractFields(tf, "x")).error).toBe("extraction failed");
  });
});
