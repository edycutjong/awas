/**
 * gate.ts leftovers: corpus merging, entity matching with several occurrences / phones, and the two defensive
 * branches that need a stripped match index or a stubbed word counter.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { addToCorpus, gateLine, type Corpus } from "@/lib/gate";

afterEach(() => vi.restoreAllMocks());

const URL_A = "https://news.example.org/a";
const quoteOf = (page: string, c: Corpus, ctx: { company?: string; phones: string[] }) => gateLine({ url: URL_A, quote: page, claim: "c" }, c, ctx);
function corpusOf(page: string): Corpus {
  const c: Corpus = new Map();
  addToCorpus(c, URL_A, "company", { title: "T", pageText: page });
  return c;
}

describe("addToCorpus merging", () => {
  it("keeps the strongest purpose, fills a missing title, and de-duplicates and skips blank chunks", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "pattern", { rankedText: "alpha beta gamma [...]   [...] alpha beta gamma" });
    addToCorpus(c, URL_A, "advisory", { title: "Late title", pageText: "page one" });
    addToCorpus(c, URL_A, "pattern", { title: "Ignored", pageText: "page one" });
    addToCorpus(c, URL_A, "company", { pageText: "   " });
    const doc = c.get(URL_A)!;
    expect(doc.purpose).toBe("company");
    expect(doc.title).toBe("Late title");
    expect(doc.chunks.map((x) => `${x.basis}:${x.text}`)).toEqual(["ranked:alpha beta gamma", "page:page one"]);
  });
});

describe("entity matching", () => {
  const body = "Kata polisi PT Mega Karya diduga merekrut korban dan PT Mega Karya lain juga dilaporkan";
  it("a second capped occurrence of the same name does not replace the first", () => {
    const allCaps = "KATA POLISI PT MEGA KARYA DIDUGA MEREKRUT KORBAN DAN PT MEGA KARYA LAIN";
    const l = quoteOf(allCaps, corpusOf(allCaps), { company: "PT Mega Karya", phones: [] });
    expect(l).toMatchObject({ status: "verified", entity: true, entityCapped: true, entityKind: "company" });
    const generic = quoteOf(body, corpusOf(body), { company: "PT Mega Karya", phones: [] });
    expect(generic).toMatchObject({ entity: true, entityCapped: true });
  });
  it("a company name with no word tokens and matches nothing", () => {
    const l = quoteOf(body, corpusOf(body), { company: "!!!", phones: [] });
    expect(l.entity).toBe(false);
  });
  it("skips short numbers and non-matching phones; a phone beside a capped company match keeps the company result", () => {
    const text = "Polisi menyebut nomor 0812 3456 7890 dipakai PT Mega Karya untuk menipu korban kerja";
    const c = corpusOf(text);
    expect(quoteOf(text, c, { company: undefined, phones: ["123"] }).entity).toBe(false);
    expect(quoteOf(text, c, { company: undefined, phones: ["0899 9999 9999"] }).entity).toBe(false);
    const phoneOnly = quoteOf(text, c, { company: undefined, phones: ["+62 812 3456 7890"] });
    expect(phoneOnly).toMatchObject({ entity: true, entityKind: "phone", entityCapped: true });
    const both = quoteOf(text, c, { company: "PT Mega Karya", phones: ["081234567890"] });
    expect(both).toMatchObject({ entity: true, entityKind: "company", entityCapped: true });
  });
  it("copes with matches that carry no index", () => {
    const original = String.prototype.matchAll;
    vi.spyOn(String.prototype, "matchAll").mockImplementation(function (this: string, re: RegExp) {
      return [...original.call(String(this), re)].map((m) => [...m] as unknown as RegExpMatchArray)[Symbol.iterator]();
    } as typeof String.prototype.matchAll);
    const l = quoteOf(body, corpusOf(body), { company: "PT Mega Karya", phones: [] });
    expect(l.status).toBeDefined();
  });
});
