/**
 * runCheck branches the main pipeline suite leaves out: unconfigured clients, failed extraction / proposal / storage,
 * bench exclusions, phone and official-domain lookups, time budgets and the English steps. HTTP fixtures only.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { excluded, patternQuery, runCheck, validateAd } from "@/lib/pipeline";
import { localStore, type Store } from "@/lib/store";
import type { TavilyConfig, TokenFactoryConfig } from "@/lib/nebius/config";

const tf: TokenFactoryConfig = { apiKey: "k", baseUrl: "https://tf.test/v1", models: { extract: "nvidia/x", propose: "nvidia/y", message: "nvidia/z" } };
const tavily: TavilyConfig = { baseUrl: "https://tv.test", access: "key", apiKey: "tvly-x" };
const PAGE = "Polisi menyebut PT Sinar Harapan Abadi diduga merekrut 12 korban penipuan daring ke Kamboja melalui lowongan kerja di Facebook.";
const AD = "PT Sinar Harapan Abadi membuka lowongan CS online di Kamboja. Gaji Rp 15 jt. Hubungi 0812-3456-7890.";
const EXTRACTION = { is_job_offer: true, company: "PT Sinar Harapan Abadi", recruiter: null, phones: ["0812-3456-7890"], destination: "Kamboja", job: "CS online", visa: null, fees: [], promises: [] };

interface World {
  extraction?: unknown;
  extractionStatus?: number;
  proposeStatus?: number;
  lines?: { source: string; quote: string; claim_id: string; claim_en: string }[];
  messageStatus?: number;
  results?: { url: string; title?: string; content?: string; raw_content?: string }[];
  extractResults?: { url: string; raw_content?: string }[];
  extractStatus?: number;
}
function world(w: World = {}) {
  const log: { host: string; kind: string; body: Record<string, unknown> }[] = [];
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = JSON.parse(String(init?.body ?? "{}"));
    const host = new URL(u).hostname;
    if (host === "tf.test") {
      const sys: string = body.messages[0].content;
      const call = sys.includes("copy out its key details") ? "extract" : sys.includes("Propose up to 6") ? "propose" : "message";
      log.push({ host, kind: call, body });
      const status = call === "extract" ? w.extractionStatus : call === "propose" ? w.proposeStatus : w.messageStatus;
      if (status) return reply({ error: "x" }, status);
      const content =
        call === "extract" ? JSON.stringify(w.extraction === undefined ? EXTRACTION : w.extraction)
        : call === "propose" ? JSON.stringify({ lines: w.lines ?? [] })
        : JSON.stringify({ explanation_en: "E.", intro_id: "Ada laporan.", advice_id: "Jangan bayar.", intro_en: "A report.", advice_en: "Do not pay.", glosses: [{ line: 1, gloss_en: "allegedly recruited victims" }, { line: 2, gloss_en: "recruited victims" }] });
      return reply({ id: `c-${call}`, model: body.model, choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (host === "tv.test") {
      const kind = u.endsWith("/extract") ? "extract" : body.exact_match ? "exact" : "pattern";
      log.push({ host, kind, body });
      if (kind === "extract" && w.extractStatus) return reply({ error: "x" }, w.extractStatus);
      if (kind === "extract") return reply({ results: w.extractResults ?? [], usage: { credits: 1 } });
      return reply({ results: w.results ?? [], usage: { credits: 1 } });
    }
    throw new Error(`unexpected fetch ${u}`);
  }) as typeof fetch;
  return { fetchImpl, log };
}
const store = () => localStore(mkdtempSync(path.join(tmpdir(), "awas-test-")));
const ONE = { source: "S1", quote: "PT Sinar Harapan Abadi diduga merekrut 12 korban penipuan daring", claim_id: "c", claim_en: "c" };
const TWO = { source: "S2", quote: "PT Sinar Harapan Abadi diduga merekrut 12 korban penipuan daring", claim_id: "c", claim_en: "c" };

describe("small exports", () => {
  it("excluded: no exclusion, a missing title, and titles without tokens never match", () => {
    expect(excluded("https://a.example/x", "t", undefined)).toBe(false);
    expect(excluded("https://a.example/x", undefined, { domain: "b.example", title: "t" })).toBe(false);
    expect(excluded("https://a.example/x", "!!!", { domain: "b.example", title: "polisi ungkap" })).toBe(false);
    expect(excluded("https://a.example/x", "polisi ungkap", { domain: "b.example", title: "???" })).toBe(false);
    expect(excluded("https://sub.b.example/x", "z", { domain: "b.example", title: "t" })).toBe(true);
  });
  it("validateAd: empty, too short, too long, fine", () => {
    expect(validateAd("   ")).toBe("empty");
    expect(validateAd("kerja?")).toBe("too_short");
    expect(validateAd("x".repeat(20_000))).toBe("too_long");
    expect(validateAd(AD)).toBeNull();
  });
  it("patternQuery trims to 300 characters", () => {
    const q = patternQuery({ isJobOffer: true, phones: [], fees: [], promises: [], droppedFields: [], destination: { text: "K".repeat(500), start: 0, end: 500 } });
    expect(q).toHaveLength(300);
  });
});

describe("runCheck: unconfigured and failing steps", () => {
  it("empty ad: bad_input and no spend", async () => {
    const events: string[] = [];
    const pack = await runCheck({ adText: "   ", lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store() }, (e) => events.push(e));
    expect(events).toEqual(["bad_input", "done"]);
    expect(pack.rule).toBe("no check — empty");
  });
  it("without Token Factory or Tavily the run still ends with a verdict and says what failed", async () => {
    const { fetchImpl, log } = world();
    const events: string[] = [];
    const pack = await runCheck({ adText: AD, lang: "en", mode: "live", stage: "full" }, { tf: null, tavily: null, store: store(), fetchImpl }, (e) => events.push(e));
    expect(log).toEqual([]);
    expect(pack.receipt.failedSteps).toEqual(expect.arrayContaining(["extraction (Token Factory not configured)", "Tavily (not configured)"]));
    expect(pack.verdict).not.toBe("NO_RED_FLAGS_FOUND");
    expect(pack.messageSource).toBe("template");
    expect(pack.verifySteps[0]).toMatch(/^Check the company/);
  });
  it("a failed extraction is named, the rubric still runs, and Tavily is searched without company or phone", async () => {
    const { fetchImpl, log } = world({ extractionStatus: 401 });
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl });
    expect(pack.receipt.failedSteps).toContain("extraction");
    expect(pack.extraction).toBeNull();
    expect(log.some((l) => l.host === "tv.test")).toBe(false);
  });
  it("storage errors are swallowed mid-run and reported once at the end", async () => {
    const { fetchImpl } = world();
    const broken: Store = { ...store(), putPack: async () => { throw new Error("disk full"); } };
    const events: { event: string; data: unknown }[] = [];
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: broken, fetchImpl }, (event, data) => events.push({ event, data }));
    expect(pack.done).toBe(true);
    expect(events.filter((e) => e.event === "step_error" && (e.data as { step: string }).step === "storage")).toHaveLength(1);
    const nonError: Store = { ...store(), putPack: async () => { throw "weird"; } };
    const e2: { event: string; data: unknown }[] = [];
    await runCheck({ adText: AD, lang: "id", mode: "live", stage: "rubric" }, { tf, tavily, store: nonError, fetchImpl }, (event, data) => e2.push({ event, data }));
    expect(e2.find((e) => e.event === "step_error")?.data).toMatchObject({ message: "weird" });
  });
});

describe("runCheck: searches, gates and messages", () => {
  const results = [
    { url: "https://news.example.org/a", title: "Polisi ungkap", content: "x", raw_content: PAGE },
    { url: "https://kemlu.go.id/imbauan", title: "Imbauan", content: "WNI diimbau tidak tergiur tawaran kerja di Kamboja", raw_content: undefined },
    { url: "https://source.example.com/b", title: "Sumber asli", raw_content: PAGE },
  ];
  it("live: searches the company, the phone and the pattern, extracts official pages and quotes two verified lines", async () => {
    const w = world({ results, lines: [ONE, { ...TWO, source: "S3" }], extractResults: [{ url: "https://kemlu.go.id/imbauan", raw_content: "WNI diimbau tidak tergiur tawaran kerja di Kamboja dengan visa turis" }, { url: "https://x.example", raw_content: undefined }] });
    const events: string[] = [];
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl }, (e) => events.push(e));
    expect(w.log.filter((l) => l.host === "tv.test").map((l) => l.kind).sort()).toEqual(["exact", "exact", "extract", "pattern"]);
    expect(pack.lines.length).toBe(2);
    expect(pack.messageSource).toBe("model");
    expect(pack.lines.map((l) => l.glossStatus)).toEqual(["ok", "unavailable"]);
    expect(pack.lines.some((l) => l.glossStatus === "ok")).toBe(true);
    expect(events).toContain("receipt");
  });
  it("bench: no phone search, the case's own source is excluded everywhere, end_date is passed", async () => {
    const w = world({ results, lines: [ONE] , extractResults: [{ url: "https://kemlu.go.id/imbauan", raw_content: "isi" }] });
    const pack = await runCheck(
      { adText: AD, lang: "id", mode: "bench", stage: "full", exclude: { domain: "source.example.com", title: "Sumber asli" }, endDate: "2026-01-01" },
      { tf, tavily, store: store(), fetchImpl: w.fetchImpl },
    );
    const company = w.log.find((l) => l.kind === "exact")!;
    expect(company.body).toMatchObject({ end_date: "2026-01-01", exclude_domains: ["source.example.com"] });
    expect(w.log.filter((l) => l.kind === "exact")).toHaveLength(1);
    expect((w.log.find((l) => l.kind === "pattern")!.body.exclude_domains as string[])).toContain("source.example.com");
    expect(pack.tavily.length).toBeGreaterThan(0);
    const noExclude = world({ results });
    await runCheck({ adText: AD, lang: "id", mode: "bench", stage: "full" }, { tf, tavily, store: store(), fetchImpl: noExclude.fetchImpl });
    expect(noExclude.log.find((l) => l.kind === "exact")!.body.end_date).toBeUndefined();
    expect(noExclude.log.find((l) => l.kind === "exact")!.body.exclude_domains).toBeUndefined();
  });
  it("an agency on the official list is recorded in the pack's registry block", async () => {
    const { REGISTRY } = await import("@/lib/registry");
    const w = world({ extraction: { ...EXTRACTION, company: null, phones: [] } });
    const pack = await runCheck({ adText: `Lowongan kerja resmi dari ${REGISTRY.agencies[0].name} untuk pekerja di Taiwan, daftar sekarang`, lang: "id", mode: "live", stage: "extract" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl });
    expect(pack.registry?.found?.name).toBe(REGISTRY.agencies[0].name);
  });
  it("a search step that throws something that is not an Error is still just a failed step", async () => {
    const w = world({ results });
    const emit = (event: string) => { if (event === "tavily_call") throw "not an error"; };
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl }, emit);
    expect(pack.receipt.failedSteps).toContain("Tavily search (unexpected error)");
  });
  it("official-page extraction: a failed extract adds nothing; an excluded extract result is left out", async () => {
    const failing = world({ results, extractStatus: 500 });
    const a = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: failing.fetchImpl });
    expect(a.receipt.failedSteps.join(" ")).toMatch(/Tavily extract \(advisory\)/);
    const excludedExtract = world({ results, extractResults: [{ url: "https://source.example.com/b", raw_content: "Polisi menyebut PT Sinar Harapan Abadi diduga merekrut korban" }] });
    const b = await runCheck(
      { adText: AD, lang: "id", mode: "bench", stage: "full", exclude: { domain: "source.example.com", title: "zzz" } },
      { tf, tavily, store: store(), fetchImpl: excludedExtract.fetchImpl },
    );
    expect(b.tavily.some((t) => t.method === "extract")).toBe(true);
  });
  it("a proposal without an Indonesian claim falls back to the English one", async () => {
    const w = world({ results, lines: [{ ...ONE, claim_id: "", claim_en: "Reported by police" }] });
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl });
    expect(pack.lines[0].claim).toBe("Reported by police");
  });
  it("a failed proposal call is named; the run goes on to the verdict", async () => {
    const w = world({ results, proposeStatus: 401 });
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl });
    expect(pack.receipt.failedSteps).toContain("evidence proposal");
    expect(pack.lines).toEqual([]);
  });
  it("a failed message call falls back to the template", async () => {
    const w = world({ results, lines: [ONE], messageStatus: 401 });
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl });
    expect(pack.messageSource).toBe("template");
  });
  it("a tight time budget skips the proposal and the model message", async () => {
    const w = world({ results, lines: [ONE] });
    const pack = await runCheck({ adText: AD, lang: "id", mode: "live", stage: "full" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl, budgetMs: 25_000 });
    expect(pack.receipt.failedSteps).toContain("evidence proposal (time limit)");
    expect(pack.messageSource).toBe("template");
    expect(w.log.some((l) => l.kind === "propose" || l.kind === "message")).toBe(false);
  });
  it("the English steps are used for lang=en", async () => {
    const w = world();
    const pack = await runCheck({ adText: AD, lang: "en", mode: "live", stage: "extract" }, { tf, tavily, store: store(), fetchImpl: w.fetchImpl });
    expect(pack.verifySteps[0]).toMatch(/^Check the company/);
    expect(pack.messageSource).toBeNull();
  });
});
