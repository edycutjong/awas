import { describe, expect, it } from "vitest";
import { callSetting } from "@/lib/settings";
import { canonicalQueryString, presignUrl } from "@/lib/nebius/sigv4";
import { companyPattern, maskAdPhones, maskCompany, mentionsCompany } from "@/lib/mask";
import { clauseAround, isClauseBoundary, isCurriculumVitae, normaliseWithMap, words } from "@/lib/text";
import { checkRegistry } from "@/lib/registry";
import { readEvents } from "@/lib/view";

describe("settings", () => {
  it("reads the process env by default and ignores unknown knobs", () => {
    const E = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
    expect(callSetting("extract")).toBeDefined();
    expect(callSetting("extract", E({ REASONING_CALL_1: "bogus" }))).toEqual(callSetting("extract", E({})));
    expect(callSetting("extract", E({ REASONING_CALL_1: " low_effort " })).reasoning).toBe("low_effort");
  });
});

describe("sigv4", () => {
  it("sorts the query and tolerates presign defaults", () => {
    expect(canonicalQueryString({ b: "2", a: "1 2" })).toBe("a=1%202&b=2");
    const u = presignUrl({ method: "GET", origin: "https://h", path: "/k", region: "r", service: "s3", accessKeyId: "a", secretAccessKey: "s", expiresSeconds: 5 });
    expect(u.url).toContain("X-Amz-Signature");
  });
});

describe("mask", () => {
  it("handles empty / undefined company and phones", () => {
    expect(companyPattern("   ")).toBeNull();
    expect(mentionsCompany("x", undefined)).toBe(false);
    expect(mentionsCompany("x", "   ")).toBe(false);
    expect(mentionsCompany("Hubungi PT Maju Jaya", "PT. Maju  Jaya")).toBe(true);
    expect(maskCompany("abc", undefined, "id")).toBe("abc");
    expect(maskCompany("abc", "  ", "id")).toBe("abc");
    expect(maskCompany("PT Maju Jaya buka", "PT Maju Jaya", "en")).not.toContain("Maju");
    expect(maskAdPhones("hi", [], "id")).toBe("hi");
    expect(maskAdPhones("hi 0812 3456 7890", ["short"], "id")).toBe("hi 0812 3456 7890");
    expect(maskAdPhones("telp 0812-3456-7890 ok", ["+62 812 3456 7890"], "en")).not.toContain("3456");
    expect(maskAdPhones("telp 0899-0000-1111 ok", ["+62 812 3456 7890"], "en")).toContain("0899");
  });
});

describe("text", () => {
  it("handles markdown links, emphasis at the edges, and boundaries", () => {
    expect(normaliseWithMap("**bold** [link](http://x.y) _it_").text).toContain("link");
    expect(normaliseWithMap("a*b").text).toBeDefined();
    expect(normaliseWithMap("*").text).toBeDefined();
    expect(words("don't stop-now")).toEqual(["don't", "stop-now"]);
    expect(words("!!!")).toEqual([]);
    expect(isClauseBoundary("a", 5)).toBe(false);
    expect(isClauseBoundary("1.5", 1)).toBe(false);
    expect(isClauseBoundary("x,", 1)).toBe(true);
    expect(isClauseBoundary(".", 0)).toBe(true);
    expect(clauseAround("one. two. three", 6).text).toBeTruthy();
    expect(isCurriculumVitae("kirim CV anda", 6, "CV anda")).toBe(true);
    expect(isCurriculumVitae("PT x", 0, "PT x")).toBe(false);
    expect(isCurriculumVitae("CV Maju Jaya", 0, "CV Maju Jaya")).toBe(false);
    expect(isCurriculumVitae("kirim CV.", 6, " CV.")).toBeDefined();
    expect(isCurriculumVitae("CV", 0, "CV")).toBeDefined();
  });
});

describe("registry and view stream edges", () => {
  it("returns a result for an ad with no company at all", () => {
    expect(checkRegistry("Lowongan kerja di luar negeri, gaji besar").found).toBeNull();
    expect(checkRegistry("kirim CV ke email").found).toBeNull();
  });
  it("readEvents ignores lines that are neither event nor data", async () => {
    const got: unknown[] = [];
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(": comment\ndata: 1\n\n")); c.close(); } });
    await readEvents(body, (e, d) => got.push([e, d]));
    expect(got).toEqual([["message", 1]]);
  });
});
