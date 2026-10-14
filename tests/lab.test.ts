/**
 * The landing page's lab (public/landing/lab.js) must be the app's own code: built from the current src/lib, and
 * giving the same answers as the modules it was compiled from.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { addToCorpus, gateLine, type Corpus, type Proposal } from "@/lib/gate";
import { evaluateRubric } from "@/lib/rubric";
import { decide } from "@/lib/verdict";

const root = path.resolve(import.meta.dirname, "..");
const bundle = readFileSync(path.join(root, "public/landing/lab.js"), "utf8");
const plain = (x: unknown) => JSON.parse(JSON.stringify(x));

type Lab = {
  evaluateRubric: typeof evaluateRubric;
  gateLine: typeof gateLine;
  addToCorpus: typeof addToCorpus;
  decide: typeof decide;
};

function loadLab(): Lab {
  const ctx = vm.createContext({ TextEncoder });
  vm.runInContext(bundle, ctx);
  return (ctx as unknown as { AwasLab: Lab }).AwasLab;
}

const ADS = [
  "Dibutuhkan CS online untuk Kamboja. Gaji Rp 15 jt/bulan, tanpa pengalaman.\nVisa turis diurus, tiket ditanggung. Biaya admin Rp 3 jt sebelum berangkat.",
  "Lowongan admin di Malaysia, tanpa visa turis, visa kerja resmi. Semua biaya ditanggung perusahaan sebelum berangkat.",
  "Hiring customer service in Cambodia. Visit visa holders may apply. Passport will be held by the company.",
  "Dicari operator produksi untuk Jepang, kontrak 3 tahun, pelatihan bahasa di LPK resmi.",
];

const PAGE = "https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo";
const PAGE_TEXT =
  "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah.\n\n" +
  "Biaya keberangkatan “ditalangi”, dengan iming-iming gratis di awal, namun pada akhirnya menjadi utang besar yang dipotong dari gaji (jeratan utang).";

const PROPOSALS: Proposal[] = [
  { url: PAGE, quote: "menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah", claim: "c" },
  { url: PAGE, quote: "menggunakan visa turis atau visa kunjungan untuk bekerja adalah visa kerja yang sah", claim: "c" },
  { url: PAGE, quote: "Biaya keberangkatan \"ditalangi\", dengan iming-iming gratis di awal", claim: "c" },
  { url: PAGE, quote: "visa turis", claim: "c" },
  { url: "https://example.org/not-returned", quote: "menggunakan visa turis atau visa kunjungan untuk bekerja", claim: "c" },
];

describe("landing lab bundle", () => {
  it("is built from the current src/lib (else: npm run build:lab)", () => {
    const sources = bundle.match(/lab-sources: ([^\n]+)/)?.[1].trim().split(" ") ?? [];
    const recorded = bundle.match(/source-sha256: ([0-9a-f]{64})/)?.[1];
    const hash = createHash("sha256");
    for (const f of sources) hash.update(`${f}\n${readFileSync(path.join(root, f), "utf8")}\n`);
    expect(sources.length).toBeGreaterThan(0);
    expect(recorded, "public/landing/lab.js is older than src/lib — run `npm run build:lab`").toBe(hash.digest("hex"));
  });

  it("gives the same rubric flags and rule verdict as src/lib", () => {
    const lab = loadLab();
    for (const ad of ADS) {
      expect(plain(lab.evaluateRubric(ad, null))).toEqual(plain(evaluateRubric(ad, null)));
      expect(plain(lab.decide(lab.evaluateRubric(ad, null), [], []))).toEqual(plain(decide(evaluateRubric(ad, null), [], [])));
    }
  });

  it("gives the same quote-gate result, page hash included, as src/lib", () => {
    const lab = loadLab();
    const corpus: Corpus = new Map();
    const labCorpus: Corpus = new Map();
    addToCorpus(corpus, PAGE, "advisory", { title: "t", pageText: PAGE_TEXT });
    lab.addToCorpus(labCorpus, PAGE, "advisory", { title: "t", pageText: PAGE_TEXT });
    const results = PROPOSALS.map((p) => gateLine(p, corpus, { phones: [] }));
    expect(results.map((r) => r.status)).toEqual(["verified", "dropped", "verified", "dropped", "dropped"]);
    for (const [i, p] of PROPOSALS.entries()) {
      expect(plain(lab.gateLine(p, labCorpus, { phones: [] }))).toEqual(plain(results[i]));
    }
  });
});
