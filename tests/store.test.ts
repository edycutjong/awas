import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ipHash, isBench, isJudge, localStore, RATE_LIMIT_PER_HOUR } from "@/lib/store";
import { locate, toExtraction, validateExtraction } from "@/lib/extract";

describe("per-IP rate slots", () => {
  it("allow exactly RATE_LIMIT_PER_HOUR live runs per hashed IP per hour", async () => {
    const s = localStore(mkdtempSync(path.join(tmpdir(), "awas-rate-")));
    const h = ipHash("203.0.113.7", "2026-10-15");
    let ok = 0;
    for (let i = 0; i < RATE_LIMIT_PER_HOUR + 3; i++) if (await s.claimRateSlot(h, "2026-10-15T08")) ok++;
    expect(ok).toBe(RATE_LIMIT_PER_HOUR);
    expect(await s.claimRateSlot(h, "2026-10-15T09")).toBe(true);
    expect(await s.claimRateSlot(ipHash("203.0.113.8", "2026-10-15"), "2026-10-15T08")).toBe(true);
  });

  it("never stores the raw IP and rotates the hash daily", () => {
    expect(ipHash("203.0.113.7", "2026-10-15")).not.toContain("203");
    expect(ipHash("203.0.113.7", "2026-10-15")).not.toBe(ipHash("203.0.113.7", "2026-10-16"));
  });

  it("judge code and bench secret compare in constant time and fail closed", () => {
    expect(isJudge("abc", "abc")).toBe(true);
    expect(isJudge("abd", "abc")).toBe(false);
    expect(isJudge("abc", undefined)).toBe(false);
    expect(isBench(null, "s")).toBe(false);
  });
});

describe("extraction spans are located by code", () => {
  const ad = "Dibutuhkan CS online untuk Kamboja. Gaji Rp 15 jt/bulan, tanpa pengalaman.\nVisa turis diurus.";
  it("finds exact and normalised pieces, and drops what is not in the ad", () => {
    expect(locate(ad, "Kamboja")).toEqual({ text: "Kamboja", start: ad.indexOf("Kamboja"), end: ad.indexOf("Kamboja") + 7 });
    expect(locate(ad, "visa  TURIS diurus")?.text).toBe("Visa turis diurus");
    expect(locate(ad, "Myanmar")).toBeNull();
    const ex = toExtraction(ad, { is_job_offer: true, company: "PT Palsu", recruiter: null, phones: [], destination: "Kamboja", job: "CS online", visa: "Visa turis", fees: [], promises: ["Gaji Rp 15 jt/bulan", "tanpa pengalaman", "bonus besar"] });
    expect(ex.company).toBeUndefined();
    expect(ex.droppedFields).toEqual(["company", "promises"]);
    expect(ex.promises.map((p) => p.text)).toEqual(["Gaji Rp 15 jt/bulan", "tanpa pengalaman"]);
  });

  it("validates the reply shape", () => {
    expect(validateExtraction({ is_job_offer: true, company: null, phones: [], fees: [], promises: [] })).toBeNull();
    expect(validateExtraction({ is_job_offer: "yes" })).toMatch(/boolean/);
    expect(validateExtraction({ is_job_offer: true, phones: [1] })).toMatch(/phones/);
  });
});
