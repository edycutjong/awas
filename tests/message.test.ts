import { describe, expect, it } from "vitest";
import { assemble, attribution, glossKeepsHedges, proseProblem, templateProse, verifySteps } from "@/lib/message";
import type { EvidenceLine, Flag } from "@/lib/types";

const line = (quote: string): EvidenceLine => ({
  url: "https://www.kompas.example/read/1", quote, claim: "", status: "verified", entity: true, entityCapped: false,
  entityKind: "company", negative: true, guard: false, chunkBasis: "page", purpose: "company",
});

describe("the canonical attribution (invariant 4)", () => {
  it("ends every quoted line of the message", () => {
    const msg = assemble("STOP", { introId: "Intro.", adviceId: "Saran.", introEn: "Intro.", adviceEn: "Advice." }, [line("PT X diduga merekrut korban ke Kamboja")], new Map());
    expect(msg.id).toContain("“PT X diduga merekrut korban ke Kamboja” — Dilaporkan oleh kompas.example, bukan tuduhan kami.");
    expect(msg.en).toContain("(Indonesian original) — Reported by kompas.example, not our accusation.");
    expect(attribution("https://www.antaranews.com/berita/1", "id")).toBe("Dilaporkan oleh antaranews.com, bukan tuduhan kami.");
  });

  it("uses the English gloss only when it kept the hedges", () => {
    const msg = assemble("STOP", { introId: "", adviceId: "", introEn: "", adviceEn: "" }, [line("PT X diduga merekrut korban")], new Map([[1, { gloss: "PT X allegedly recruited victims", ok: true }]]));
    expect(msg.en).toContain("“PT X allegedly recruited victims” (translated) — Reported by");
  });
});

describe("hedge-keeping glosses", () => {
  it("requires allegedly/suspected for diduga and reportedly for dilaporkan", () => {
    expect(glossKeepsHedges("PT X diduga merekrut korban", "PT X allegedly recruited victims")).toBe(true);
    expect(glossKeepsHedges("PT X diduga merekrut korban", "PT X recruited victims")).toBe(false);
    expect(glossKeepsHedges("Korban dilaporkan disekap", "Victims were reportedly held")).toBe(true);
    expect(glossKeepsHedges("Korban disekap", "Victims were held")).toBe(true);
  });
});

describe("the model's own sentences", () => {
  const ok = { explanation_en: "Two rules fired.", intro_id: "Iklan ini berisiko.", advice_id: "Periksa izinnya.", intro_en: "Risky ad.", advice_en: "Check the licence." };
  it("may not name the company", () => {
    expect(proseProblem({ ...ok, intro_id: "PT Sinar Harapan Abadi menipu." }, "PT Sinar Harapan Abadi")).toMatch(/names the company/);
    expect(proseProblem(ok, "PT Sinar Harapan Abadi")).toBeNull();
  });
  it("may not carry quotations of their own", () => {
    expect(proseProblem({ ...ok, advice_en: 'The page says "it is a scam".' }, undefined)).toMatch(/quotation/);
  });
});

describe("template message and verify steps", () => {
  const f = (id: Flag["id"]): Flag => ({ id, class: "CAUTION", sourced: true, via: "pattern", span: { text: "", start: 0, end: 0 }, label: "", source: null });
  it("always points to the official P3MI list and adds steps only for rules that fired", () => {
    const s = verifySteps([f("fee_before_departure"), f("tourist_visa")]);
    expect(s.en[0]).toContain("siskop2mi.bp2mi.go.id");
    expect(s.en.some((x) => x.includes("written work contract"))).toBe(true);
    expect(s.en.some((x) => x.includes("work visa"))).toBe(true);
    expect(s.en.some((x) => x.includes("passport"))).toBe(false);
  });
  it("never calls anything safe", () => {
    const t = templateProse({ verdict: "NO_RED_FLAGS_FOUND", rule: "", reasons: [], flags: [], lines: [], phones: [] });
    expect(`${t.introEn} ${t.explanationEn}`.toLowerCase()).not.toContain("safe");
    expect(t.introEn).toContain("not a guarantee");
  });
});
