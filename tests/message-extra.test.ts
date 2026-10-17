/**
 * message.ts: every verify step, the three template wordings, and writeMessage against a replaced chat() —
 * success, a failed call, prose that names the company or quotes (regenerated once), and glosses of every shape.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOutcome } from "@/lib/tf";

const chatMock = vi.fn<(...a: unknown[]) => Promise<ChatOutcome>>();
vi.mock("@/lib/tf", async (orig) => ({ ...(await orig<typeof import("@/lib/tf")>()), chat: (...a: unknown[]) => chatMock(...a) }));

import { domainOf, proseProblem, templateProse, verifySteps, writeMessage, type MessageInput } from "@/lib/message";
import type { EvidenceLine, Flag, FlagId } from "@/lib/types";

const receipt = { call: "message" as const, model: "m", promptTokens: 1, completionTokens: 1, reasoningTokens: null, ms: 1, format: "json_object", attempts: 1 };
const tf = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "m", propose: "m", message: "m" } };
const flag = (id: FlagId): Flag => ({ id, class: "CAUTION", sourced: true, via: "pattern", span: { text: "x", start: 0, end: 1 }, label: "l", source: null });
const line = (quote: string, url = "https://www.kompas.example/read/1"): EvidenceLine => ({
  url, quote, claim: "", status: "verified", entity: true, entityCapped: false, entityKind: "company",
  negative: true, guard: false, chunkBasis: "page", purpose: "company",
});
const raw = (o: Record<string, unknown> = {}) => ({
  explanation_en: "Because of the flags.", intro_id: "Intro id.", advice_id: "Saran id.", intro_en: "Intro en.", advice_en: "Advice en.", ...o,
});
const ok = (value: unknown): ChatOutcome => ({ ok: true, content: "{}", value, receipt, error: null });
const input = (o: Partial<MessageInput> = {}): MessageInput => ({ verdict: "STOP", rule: "r", reasons: ["a", "b"], flags: [], lines: [line("PT Maju diduga merekrut korban")], phones: [], ...o });

beforeEach(() => chatMock.mockReset());

describe("domainOf / verifySteps / templateProse", () => {
  it("falls back to the raw string for a URL that does not parse", () => {
    expect(domainOf("not a url")).toBe("not a url");
    expect(domainOf("https://www.x.example/a")).toBe("x.example");
  });
  it("adds a step for every rule that fired", () => {
    const all: FlagId[] = ["not_on_p3mi_list", "p3mi_suspended", "non_placement_country", "fee_before_contract", "debt_bondage", "quick_departure", "high_pay_light_work", "tourist_visa", "passport_retention", "personal_recruiter"];
    const full = verifySteps(all.map(flag));
    expect(full.id.length).toBe(full.en.length);
    expect(full.id.length).toBe(1 + all.length + 1 /* first check + call centre */);
    expect(verifySteps([flag("fee_before_departure")]).en.join(" ")).toMatch(/written work contract/);
    expect(verifySteps([flag("fee_asked")]).en.join(" ")).toMatch(/written work contract/);
    expect(verifySteps([flag("visit_visa_holder")]).en.join(" ")).toMatch(/work visa/);
    expect(verifySteps([flag("no_company")]).en.join(" ")).toMatch(/licence number/);
    expect(verifySteps([]).en).toHaveLength(2);
  });
  it("writes a template for each verdict, with and without quoted lines", () => {
    const stop = templateProse(input());
    expect(stop.introId).toContain("laporan yang diterbitkan");
    expect(stop.explanationEn).toBe("Awas says STOP because: a; b.");
    expect(templateProse(input({ lines: [] })).introEn).toBe("This check found red flags in the ad.");
    const verify = templateProse(input({ verdict: "VERIFY_FIRST" }));
    expect(verify.explanationEn).toContain("VERIFY FIRST");
    const none = templateProse(input({ verdict: "NO_RED_FLAGS_FOUND" }));
    expect(none.introEn).toMatch(/not a guarantee/);
    expect(none.adviceEn).toBe(verifySteps([]).en[0]);
  });
});

describe("proseProblem", () => {
  it("flags the company named in the model's own words, and a quotation of its own", () => {
    expect(proseProblem(raw({ intro_en: "PT Maju Jaya is bad" }) as never, "PT Maju Jaya")).toBe("names the company in its own words");
    expect(proseProblem(raw({ advice_en: "Do “this”" }) as never, undefined)).toBe("carries a quotation of its own");
    expect(proseProblem(raw() as never, "PT Maju Jaya")).toBeNull();
  });
});

describe("writeMessage", () => {
  it("uses the template when Token Factory is not configured", async () => {
    const r = await writeMessage(null, input());
    expect(r).toMatchObject({ source: "template", receipt: null, error: "Token Factory is not configured" });
    expect(r.messageEn).toContain("STOP — do not travel yet");
  });
  it("assembles the model's prose with masked glosses, and numbers the gloss-only lines", async () => {
    chatMock.mockResolvedValue(ok(raw({
      glosses: [
        { line: 1, gloss_en: "PT Maju allegedly recruited victims, call 0812-3456-7890" },
        { line: 2, gloss_en: "A second report said it was reported" },
        { line: 9, gloss_en: "no such line" },
        { line: 1.5, gloss_en: 7 },
        { line: 2, gloss_en: "   " },
      ],
    })));
    const r = await writeMessage(tf, input({
      company: "PT Maju", phones: ["081234567890"], glossOnly: [line("Korban dilaporkan disekap", "https://b.example/x")],
    }), undefined, 99);
    expect(r.source).toBe("model");
    expect(r.error).toBeNull();
    expect(r.glosses.get(1)?.gloss).toContain("PT Maju");
    expect(r.glosses.get(2)?.ok).toBe(false);
    expect(r.messageEn).toContain("Intro en.");
    expect(chatMock.mock.calls[0][1]).toMatchObject({ call: "message", deadlineMs: 99 });
    expect(String((chatMock.mock.calls[0][1] as { user: string }).user)).toContain("(gloss only)");
  });
  it("masks the company in a gloss whose quote does not itself name it, and handles no-reasons / no-lines input", async () => {
    chatMock.mockResolvedValue(ok(raw({ glosses: [{ line: 1, gloss_en: "PT Maju allegedly did it" }] })));
    const r = await writeMessage(tf, input({ reasons: [], lines: [line("Perusahaan itu diduga menipu korban")], company: "PT Maju" }));
    expect(r.glosses.get(1)?.gloss).not.toContain("Maju");
    chatMock.mockResolvedValue(ok(raw()));
    const bare = await writeMessage(tf, input({ reasons: [], lines: [] }));
    expect(bare.source).toBe("model");
    expect(String((chatMock.mock.calls[chatMock.mock.calls.length - 1][1] as { user: string }).user)).toContain("(none)");
  });
  it("falls back to the template when the call fails, keeping the receipt and the error", async () => {
    chatMock.mockResolvedValue({ ok: false, content: null, value: null, receipt, error: "boom" });
    expect(await writeMessage(tf, input())).toMatchObject({ source: "template", error: "boom", receipt });
    chatMock.mockResolvedValue({ ok: true, content: "x", value: null, receipt, error: null });
    expect(await writeMessage(tf, input())).toMatchObject({ source: "template", error: null });
  });
  it("hands chat() a validator for the model's JSON", async () => {
    chatMock.mockResolvedValue(ok(raw()));
    await writeMessage(tf, input());
    const validate = (chatMock.mock.calls[0][1] as { validate: (v: unknown) => string | null }).validate;
    expect(validate(null)).toBe("not an object");
    expect(validate("x")).toBe("not an object");
    expect(validate(raw({ intro_id: "  " }))).toBe("intro_id missing");
    expect(validate(raw({ advice_en: 3 }))).toBe("advice_en missing");
    expect(validate(raw())).toBeNull();
  });
  it("regenerates once when the prose names the company, then settles for the template", async () => {
    chatMock.mockResolvedValue(ok(raw({ intro_en: "PT Maju is the culprit" })));
    const r = await writeMessage(tf, input({ company: "PT Maju" }));
    expect(chatMock).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ source: "template", error: "message names the company in its own words" });
    chatMock.mockReset();
    chatMock.mockResolvedValueOnce(ok(raw({ advice_id: "Jangan “percaya”" }))).mockResolvedValueOnce(ok(raw()));
    expect((await writeMessage(tf, input())).source).toBe("model");
  });
});
