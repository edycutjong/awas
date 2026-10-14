import { describe, expect, it } from "vitest";
import { clauseAround, normalise, normaliseWithMap, words } from "@/lib/text";

describe("normalise — the gate's contract", () => {
  it("lowercases, maps curly quotes and dashes to ASCII, collapses whitespace", () => {
    expect(normalise("  “Korban”   DIREKRUT lewat\tFacebook — kata ‘polisi’ ")).toBe('"korban" direkrut lewat facebook - kata \'polisi\'');
  });

  it("drops zero-width characters and soft hyphens", () => {
    expect(normalise("pe​ni­puan")).toBe("penipuan");
  });

  it("strips markdown emphasis and link syntax", () => {
    expect(normalise("**Polisi** menangkap _perekrut_ [PT Maju](https://x.example/a) kemarin")).toBe("polisi menangkap perekrut pt maju kemarin");
  });

  it("keeps an offset map back to the raw text", () => {
    const raw = "Aa  “Bb”";
    const n = normaliseWithMap(raw);
    expect(n.text).toBe('aa "bb"');
    const i = n.text.indexOf("bb");
    expect(raw.slice(n.map[i], n.map[i + 1] + 1)).toBe("Bb");
  });

  it("counts words on letter/digit runs, keeping hyphenated words whole", () => {
    expect(words("Iming-iming gaji Rp 15 juta, kata dia.")).toEqual(["iming-iming", "gaji", "rp", "15", "juta", "kata", "dia"]);
  });
});

describe("clauseAround", () => {
  it("is bounded by clause punctuation and newlines", () => {
    const t = "tanpa pengalaman. Visa turis diurus, tiket ditanggung";
    expect(clauseAround(t, t.indexOf("Visa")).text).toBe(" Visa turis diurus");
  });

  it("does not split numbers or abbreviations", () => {
    const t = "Biaya Rp. 5.000.000 dibayar ke PT. Maju sebelum tanda tangan kontrak; lalu berangkat";
    expect(clauseAround(t, t.indexOf("Biaya")).text).toBe("Biaya Rp. 5.000.000 dibayar ke PT. Maju sebelum tanda tangan kontrak");
  });

  it("keeps a decimal comma inside a number", () => {
    const t = "gaji 9,5 juta, tanpa pengalaman";
    expect(clauseAround(t, 0).text).toBe("gaji 9,5 juta");
  });
});
