import { describe, expect, it } from "vitest";
import { addToCorpus, fragmentUrl, gateLine, type Corpus } from "@/lib/gate";

const URL_A = "https://news.example.org/a";
const PAGE =
  "Polisi menetapkan dua tersangka. PT Sinar Harapan Abadi diduga merekrut 12 korban untuk bekerja sebagai operator penipuan daring di Kamboja.\n" +
  "Perusahaan lain, PT Sinar Harapan Abadi Jaya, membantah terlibat.";

function corpus(): Corpus {
  const c: Corpus = new Map();
  addToCorpus(c, URL_A, "company", { title: "Polisi ungkap perekrutan", pageText: PAGE });
  addToCorpus(c, "https://kemlu.example.go.id/imbauan", "advisory", {
    rankedText: "WNI diimbau tidak tergiur tawaran kerja di Kamboja [...] dengan visa kunjungan untuk bekerja di luar negeri secara ilegal",
  });
  return c;
}

const ctx = { company: "PT Sinar Harapan Abadi", phones: [] as string[] };

describe("verified ⇔ URL returned ∧ ≥ 6 words ∧ normalised substring of one chunk", () => {
  it("verifies a verbatim quote and records the basis, offset and hash", () => {
    const l = gateLine({ url: URL_A, quote: "PT Sinar Harapan Abadi diduga merekrut 12 korban", claim: "c" }, corpus(), ctx);
    expect(l.status).toBe("verified");
    expect(l.chunkBasis).toBe("page");
    expect(l.matchOffset).toBe(PAGE.indexOf("PT Sinar"));
    expect(l.pageSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tolerates case, whitespace and curly quotes, and returns the page's own characters", () => {
    const l = gateLine({ url: URL_A, quote: "pt  SINAR harapan abadi diduga   merekrut 12 korban", claim: "" }, corpus(), ctx);
    expect(l.status).toBe("verified");
    expect(l.quote).toBe("PT Sinar Harapan Abadi diduga merekrut 12 korban");
  });

  it("drops a quote that is not on the page", () => {
    const l = gateLine({ url: URL_A, quote: "PT Sinar Harapan Abadi merekrut 50 korban di Myanmar", claim: "" }, corpus(), ctx);
    expect(l).toMatchObject({ status: "dropped", reason: "not_in_page" });
  });

  it("drops a URL Tavily did not return in this run", () => {
    expect(gateLine({ url: "https://elsewhere.example/x", quote: "PT Sinar Harapan Abadi diduga merekrut 12 korban", claim: "" }, corpus(), ctx).reason).toBe("url_not_returned");
  });

  it("drops quotes under 6 words", () => {
    expect(gateLine({ url: URL_A, quote: "diduga merekrut 12 korban", claim: "" }, corpus(), ctx).reason).toBe("too_short");
  });

  it("never lets a quote span the [...] separator of query-ranked chunks", () => {
    const l = gateLine({ url: "https://kemlu.example.go.id/imbauan", quote: "tergiur tawaran kerja di Kamboja dengan visa kunjungan", claim: "" }, corpus(), ctx);
    expect(l).toMatchObject({ status: "dropped", reason: "spans_chunks" });
    const ok = gateLine({ url: "https://kemlu.example.go.id/imbauan", quote: "dengan visa kunjungan untuk bekerja di luar negeri", claim: "" }, corpus(), ctx);
    expect(ok).toMatchObject({ status: "verified", chunkBasis: "ranked" });
  });
});

describe("entity / negative / guard", () => {
  it("company match + negative term, no guard → the company-matched facts", () => {
    const l = gateLine({ url: URL_A, quote: "PT Sinar Harapan Abadi diduga merekrut 12 korban untuk bekerja", claim: "" }, corpus(), ctx);
    expect(l).toMatchObject({ entity: true, entityCapped: false, entityKind: "company", negative: true, guard: false });
  });

  it("a longer name continued by a capitalised word is a different company (same-prefix pair)", () => {
    const l = gateLine({ url: URL_A, quote: "Perusahaan lain, PT Sinar Harapan Abadi Jaya, membantah terlibat.", claim: "" }, corpus(), ctx);
    expect(l.status).toBe("verified");
    expect(l.entity).toBe(false);
  });

  it("a guard term marks the line (misused or denied name)", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", { pageText: "Penipu mencatut nama PT Sinar Harapan Abadi untuk menjaring korban di Kamboja." });
    const l = gateLine({ url: URL_A, quote: "Penipu mencatut nama PT Sinar Harapan Abadi untuk menjaring korban", claim: "" }, c, ctx);
    expect(l).toMatchObject({ entity: true, negative: true, guard: true });
  });

  it("'bukan' within 5 words before the company name is a guard", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", { pageText: "Perekrutnya bukan dari PT Sinar Harapan Abadi, tegas polisi soal korban." });
    const l = gateLine({ url: URL_A, quote: "Perekrutnya bukan dari PT Sinar Harapan Abadi, tegas polisi soal korban.", claim: "" }, c, ctx);
    expect(l.guard).toBe(true);
  });

  it("a name made only of generic words counts toward VERIFY FIRST only", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", { pageText: "Polisi menyebut PT Maju Jaya merekrut korban penipuan ke Kamboja." });
    const l = gateLine({ url: URL_A, quote: "Polisi menyebut PT Maju Jaya merekrut korban penipuan ke Kamboja.", claim: "" }, c, { company: "PT Maju Jaya", phones: [] });
    expect(l).toMatchObject({ entity: true, entityCapped: true });
  });

  it("ALL-CAPS text cannot be checked for a continuation, so the match is capped", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", { pageText: "POLISI TANGKAP PERekrut. PT SINAR HARAPAN ABADI DIDUGA REKRUT KORBAN TPPO" });
    const l = gateLine({ url: URL_A, quote: "PT SINAR HARAPAN ABADI DIDUGA REKRUT KORBAN TPPO", claim: "" }, c, ctx);
    expect(l).toMatchObject({ entity: true, entityCapped: true, negative: true });
  });

  it("a phone-only match (last 9 digits inside one number) is capped", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "phone", { pageText: "Warga melaporkan nomor 0812 3456 7890 yang menawarkan kerja ke Kamboja sebagai penipuan." });
    const l = gateLine({ url: URL_A, quote: "Warga melaporkan nomor 0812 3456 7890 yang menawarkan kerja", claim: "" }, c, { phones: ["+62 812-3456-7890"] });
    expect(l).toMatchObject({ entity: true, entityKind: "phone", entityCapped: true });
  });
});

describe("text-fragment link", () => {
  it("uses the first and last 4 words, escaping the fragment syntax characters", () => {
    expect(fragmentUrl("https://x.example/a#top", "korban di-iming-iming gaji besar, lalu dibawa ke Kamboja oleh perekrut")).toBe(
      "https://x.example/a#:~:text=korban%20di%2Diming%2Diming%20gaji%20besar%2C,ke%20Kamboja%20oleh%20perekrut",
    );
  });

  it("uses the whole quote when it is short", () => {
    expect(fragmentUrl("https://x.example/a", "dengan visa kunjungan untuk bekerja")).toBe("https://x.example/a#:~:text=dengan%20visa%20kunjungan%20untuk%20bekerja");
  });
});

describe("guard terms match anywhere in the quote (spec rule; tuned on the dev set only)", () => {
  it("a fake vacancy is the scam itself, not a misused name: 'lowongan palsu' does not guard (Amendment 4)", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", { pageText: "PT Sinar Harapan Abadi merekrut korban melalui lowongan palsu di Kamboja." });
    const l = gateLine({ url: URL_A, quote: "PT Sinar Harapan Abadi merekrut korban melalui lowongan palsu", claim: "" }, c, ctx);
    expect(l).toMatchObject({ entity: true, negative: true, guard: false });
  });

  it("impersonation artefacts and 'mengatasnamakan' still guard", () => {
    const c: Corpus = new Map();
    addToCorpus(c, URL_A, "company", {
      pageText: "Waspada akun palsu PT Sinar Harapan Abadi yang menipu korban. Lowongan penipuan yang mengatasnamakan PT Sinar Harapan Abadi beredar.",
    });
    expect(gateLine({ url: URL_A, quote: "Waspada akun palsu PT Sinar Harapan Abadi yang menipu korban", claim: "" }, c, ctx).guard).toBe(true);
    expect(gateLine({ url: URL_A, quote: "Lowongan penipuan yang mengatasnamakan PT Sinar Harapan Abadi beredar", claim: "" }, c, ctx).guard).toBe(true);
  });
});
