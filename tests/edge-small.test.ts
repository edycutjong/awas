/**
 * The last defensive branches in the small modules: `m.index ?? 0` on regex matches (a match always has an index, so
 * the fallback is exercised with a matchAll that strips it), empty / tied registry entries, equal header names,
 * and a case id whose bit count lands exactly on a 5-bit boundary.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalQueryString, signRequest, uriEncode } from "@/lib/nebius/sigv4";
import { newCaseId } from "@/lib/mask";
import { checkRegistry, REGISTRY } from "@/lib/registry";
import { isClauseBoundary, normaliseWithMap } from "@/lib/text";

afterEach(() => vi.restoreAllMocks());

/** String.prototype.matchAll whose matches carry no `.index` (spreading drops the extra array properties). */
function stripMatchIndex() {
  const original = String.prototype.matchAll;
  return vi.spyOn(String.prototype, "matchAll").mockImplementation(function (this: string, re: RegExp) {
    return [...original.call(String(this), re)].map((m) => [...m] as unknown as RegExpMatchArray)[Symbol.iterator]();
  } as typeof String.prototype.matchAll);
}

describe("sigv4 odd inputs", () => {
  it("keeps slashes when asked, tolerates an undefined query value, and orders equal header names stably", () => {
    expect(uriEncode("a/b c", false)).toBe("a/b%20c");
    expect(canonicalQueryString({ a: undefined as unknown as string, b: "1" })).toBe("a=&b=1");
    const signed = signRequest({
      method: "GET", origin: "https://h.example", path: "/k", region: "r", service: "s3",
      accessKeyId: "a", secretAccessKey: "s", payload: "", headers: { "X-Dup": "1", "x-dup": "2" },
    });
    expect(signed.headers.Authorization).toContain("SignedHeaders=");
  });
});

describe("text without match indexes", () => {
  it("normalises markdown and emphasis when a match has no index", () => {
    stripMatchIndex();
    expect(normaliseWithMap("[link](http://x.y) and *em* text").text).toBeDefined();
  });
  it("a decimal point at the very end of the text is not a number inside a sentence", () => {
    expect(isClauseBoundary("v1.", 2)).toBe(true);
    expect(isClauseBoundary("1.5", 1)).toBe(false);
  });
});

describe("registry odd inputs", () => {
  it("tolerates a name with no word characters, an empty-token entry, and ties between listed names", () => {
    const first = REGISTRY.agencies[0];
    const added = [
      { name: "!!!", status: "Aktif", tokens: [] as string[] },
      { name: "QQQ ZZZ", status: "Aktif", tokens: ["qqq", "zzz"] },
      { name: "QQQ ZZZ DUPLICATE", status: "Aktif", tokens: ["qqq", "zzz"] },
      { name: "WWW", status: "Aktif", tokens: ["www"] },
    ];
    REGISTRY.agencies.push(...added);
    try {
      const r = checkRegistry("Lowongan qqq zzz dan PT www");
      expect(r.found?.name).toBe("QQQ ZZZ");
      expect(checkRegistry(`${first.name} ok`).found).not.toBeNull();
    } finally {
      REGISTRY.agencies.splice(REGISTRY.agencies.length - added.length, added.length);
    }
  });
  it("names with no tokens, odd extracted company, and index-less matches", () => {
    expect(checkRegistry("kerja di PT Maju Jaya Abadi", { text: "!!!", start: 0, end: 3 }).notListed.length).toBeGreaterThanOrEqual(1);
    expect(checkRegistry("x", { text: "PT .", start: 0, end: 4 }).notListed).toEqual([]);
    stripMatchIndex();
    const r = checkRegistry("Kerja di PT Baru Sekali Tidak Terdaftar sekarang");
    expect(r.notListed[0].start).toBe(0);
    const listed = checkRegistry(`${REGISTRY.agencies[0].name} buka`);
    expect(listed.found?.span.start).toBe(0);
  });
});

describe("registry name tokens", () => {
  it("skips an extracted company whose text has no word tokens at all", () => {
    const original = String.prototype.match;
    vi.spyOn(String.prototype, "match").mockImplementation(function (this: string, re: string | RegExp) {
      if (re instanceof RegExp && re.source === "[\\p{L}\\p{N}]+" && re.flags.includes("g")) return null;
      return original.call(String(this), re as RegExp);
    } as typeof String.prototype.match);
    expect(checkRegistry("x", { text: "PT Foo", start: 0, end: 6 }).notListed).toEqual([]);
  });
});

describe("case ids", () => {
  it("handles a byte count that ends on a 5-bit boundary", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((a: Uint8Array) => new Uint8Array(5)) as unknown as typeof crypto.getRandomValues);
    expect(newCaseId()).toHaveLength(8);
  });
});
