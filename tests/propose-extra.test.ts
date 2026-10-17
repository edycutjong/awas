/**
 * propose.ts: paragraph splitting, the filtered-source budget, the ad description, validation of the model's lines,
 * proposeLines against a replaced chat(), and the sentence-picker ablation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOutcome } from "@/lib/tf";

const chatMock = vi.fn<(...a: unknown[]) => Promise<ChatOutcome>>();
vi.mock("@/lib/tf", async (orig) => ({ ...(await orig<typeof import("@/lib/tf")>()), chat: (...a: unknown[]) => chatMock(...a) }));

import { addToCorpus, type Corpus } from "@/lib/gate";
import { BUDGET, filterCorpus, paragraphsOf, pickSentences, proposeLines, validateLines, type FilteredSource } from "@/lib/propose";
import type { Extraction, Span } from "@/lib/types";

const receipt = { call: "propose" as const, model: "m", promptTokens: 1, completionTokens: 1, reasoningTokens: null, ms: 1, format: "json_object", attempts: 1 };
const tf = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "m", propose: "m", message: "m" } };
const span = (text: string): Span => ({ text, start: 0, end: text.length });
const ex = (o: Partial<Extraction> = {}): Extraction => ({ isJobOffer: true, phones: [], fees: [], promises: [], droppedFields: [], ...o });
const corpusOf = (docs: Record<string, string>): Corpus => {
  const c: Corpus = new Map();
  for (const [url, text] of Object.entries(docs)) addToCorpus(c, url, "company", { pageText: text });
  return c;
};
const ok = (value: unknown): ChatOutcome => ({ ok: true, content: "{}", value, receipt, error: null });

beforeEach(() => chatMock.mockReset());

describe("paragraphsOf", () => {
  it("drops blank lines and splits an over-long paragraph into sentences", () => {
    const long = `${"Kalimat pertama yang panjang sekali. ".repeat(40)}Kalimat terakhir.`;
    expect(paragraphsOf("a\n\n  \nb")).toEqual(["a", "b"]);
    const parts = paragraphsOf(long);
    expect(parts.length).toBeGreaterThan(10);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });
});

describe("filterCorpus", () => {
  it("keeps only relevant, de-duplicated paragraphs, and handles texts with no word tokens", () => {
    const c = corpusOf({
      "https://a.example/1": "PT Maju Jaya diduga menipu korban.\nPT Maju Jaya diduga menipu korban.\n---\nCuaca cerah hari ini.\nHubungi 0899-1111-2222 hari ini\nHubungi 0812-3456-7890 untuk info\nImbauan KP2MI untuk waspada.",
      "https://a.example/2": "Tidak relevan sama sekali.",
    });
    const out = filterCorpus(c, ex({ company: span("PT Maju Jaya"), phones: [span("0812-3456-7890"), span("123")] }));
    expect(out).toHaveLength(1);
    expect(out[0].paragraphs).toEqual(["PT Maju Jaya diduga menipu korban.", "Hubungi 0812-3456-7890 untuk info", "Imbauan KP2MI untuk waspada."]);
    expect(filterCorpus(c, null)[0].paragraphs).toContain("Imbauan KP2MI untuk waspada.");
    expect(filterCorpus(c, ex({ company: span("PT Lain Sekali") }))[0].paragraphs).not.toContain("Hubungi 0812-3456-7890 untuk info");
  });
  it("stops at the per-source and total budgets", () => {
    const para = (n: number) => `Korban penipuan nomor ${n} diduga direkrut ${"x".repeat(900)}`;
    const big = Array.from({ length: 6 }, (_, i) => para(i)).join("\n");
    const out = filterCorpus(corpusOf({ "https://a.example/1": big }), null);
    expect(out[0].paragraphs.join("").length).toBeLessThanOrEqual(BUDGET.perSource);
    const many: Record<string, string> = {};
    for (let i = 0; i < 8; i++) many[`https://a.example/${i}`] = [para(1), para(2), para(3)].join("\n");
    const all = filterCorpus(corpusOf(many), null);
    expect(all.reduce((s, x) => s + x.paragraphs.join("").length, 0)).toBeLessThanOrEqual(BUDGET.total);
    expect(all.length).toBeLessThan(8);
  });
});

describe("validateLines", () => {
  it("accepts a well-formed reply and names each way a reply can be malformed", () => {
    expect(validateLines(null)).toBe("not an object");
    expect(validateLines("x")).toBe("not an object");
    expect(validateLines({})).toBe("lines is not a list");
    expect(validateLines({ lines: [null] })).toBe("a line is not an object");
    expect(validateLines({ lines: ["s"] })).toBe("a line is not an object");
    expect(validateLines({ lines: [{ source: 1, quote: "q" }] })).toBe("a line lacks source or quote");
    expect(validateLines({ lines: [{ source: "S1", quote: 2 }] })).toBe("a line lacks source or quote");
    expect(validateLines({ lines: [{ source: "S1", quote: "q" }] })).toBeNull();
  });
});

describe("proposeLines", () => {
  const sources: FilteredSource[] = [{ id: "S1", url: "https://a.example/1", paragraphs: ["p"] }, { id: "S2", url: "https://b.example/2", title: "Judul", paragraphs: ["q"] }];
  const userOf = () => String((chatMock.mock.calls[chatMock.mock.calls.length - 1][1] as { user: string }).user);

  it("describes the ad from the extraction, or from the raw text when there is none", async () => {
    chatMock.mockResolvedValue(ok({ lines: [] }));
    await proposeLines(tf, "ad text", ex({ company: span("PT X"), phones: [span("0812")], destination: span("Kamboja"), job: span("CS"), visa: span("turis"), fees: [span("Rp 3 jt"), span("deposit")] }), sources, undefined, 5);
    expect(userOf()).toContain("company: PT X");
    expect(userOf()).toContain("phone: 0812");
    expect(userOf()).toContain("fees: Rp 3 jt; deposit");
    expect(userOf()).toContain("[S2] Judul — https://b.example/2");
    expect(chatMock.mock.calls[chatMock.mock.calls.length - 1][1]).toMatchObject({ deadlineMs: 5, call: "propose" });
    await proposeLines(tf, "ad text", ex(), sources);
    expect(userOf()).toContain("(none extracted)");
    await proposeLines(tf, "x".repeat(2000), null, sources);
    expect(userOf()).toContain(`Ad text:\n${"x".repeat(1500)}`);
  });
  it("maps source ids to URLs, tolerates brackets, unknown ids and missing fields, and caps the list", async () => {
    const lines = [
      { source: "[S1]", quote: "a b c d e f", claim_id: " klaim ", claim_en: " claim " },
      { source: " S2 ", quote: "g h i j k l" },
      { source: "S9", quote: undefined as unknown as string },
      ...Array.from({ length: 6 }, (_, i) => ({ source: "S1", quote: `q${i}` })),
    ];
    chatMock.mockResolvedValue(ok({ lines }));
    const out = await proposeLines(tf, "ad", null, sources);
    expect(out.error).toBeNull();
    expect(out.proposals).toHaveLength(BUDGET.maxLines);
    expect(out.proposals[0]).toEqual({ url: "https://a.example/1", quote: "a b c d e f", claim: "klaim", claimEn: "claim" });
    expect(out.proposals[1]).toMatchObject({ url: "https://b.example/2", claim: "", claimEn: "" });
    expect(out.proposals[2]).toMatchObject({ url: "unknown-source:S9", quote: "" });
  });
  it("reports the call's error, or 'proposal failed' when there is none", async () => {
    chatMock.mockResolvedValue({ ok: false, content: null, value: null, receipt, error: "boom" });
    expect(await proposeLines(tf, "ad", null, sources)).toEqual({ proposals: [], receipt, error: "boom" });
    chatMock.mockResolvedValue({ ok: true, content: "t", value: null, receipt, error: null });
    expect((await proposeLines(tf, "ad", null, sources)).error).toBe("proposal failed");
    chatMock.mockResolvedValue({ ok: false, content: null, value: null, receipt, error: null });
    expect((await proposeLines(tf, "ad", null, sources)).error).toBe("proposal failed");
  });
});

describe("pickSentences", () => {
  const src = (paragraphs: string[]): FilteredSource[] => [{ id: "S1", url: "https://a.example/1", paragraphs }];
  it("takes sentences naming the company or phone together with a negative term", () => {
    const sources = src([
      "PT Maju Jaya diduga menipu korban. Cuaca cerah. PT Maju Jaya buka cabang baru.",
      "Nomor 0812-3456-7890 dilaporkan menipu korban kerja.",
    ]);
    const got = pickSentences(sources, ex({ company: span("PT Maju Jaya"), phones: [span("0812-3456-7890")] }));
    expect(got.map((g) => g.quote)).toEqual(["PT Maju Jaya diduga menipu korban.", "Nomor 0812-3456-7890 dilaporkan menipu korban kerja."]);
    expect(pickSentences(sources, null)).toEqual([]);
    expect(pickSentences(sources, ex({ phones: [span("12")] }))).toEqual([]);
  });
  it("stops at the line cap", () => {
    const many = Array.from({ length: 10 }, () => "PT Maju Jaya diduga menipu korban.").join(" ");
    expect(pickSentences(src([many]), ex({ company: span("PT Maju Jaya") }))).toHaveLength(BUDGET.maxLines);
  });
});
