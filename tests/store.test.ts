import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ipHash, isBench, isJudge, localStore, objectStore, RATE_LIMIT_PER_HOUR, isCaseId } from "@/lib/store";
import { locate, toExtraction, validateExtraction } from "@/lib/extract";
import type { EvidencePack } from "@/lib/types";
import type { IntegrationReceipt } from "@/lib/store";
import type { StorageConfig } from "@/lib/nebius/config";

describe("per-IP rate slots", () => {
  it("allow exactly RATE_LIMIT_PER_HOUR live runs per hashed IP per hour", async () => {
    const s = localStore(mkdtempSync(path.join(tmpdir(), "awas-rate-")));
    const h = ipHash("203.0.113.7", "2026-10-15");
    let ok = 0;
    for (let i = 0; i < RATE_LIMIT_PER_HOUR + 3; i++) if (await s.claimRateSlot(h, "2026-10-15T08")) ok++;
    expect(ok).toBe(RATE_LIMIT_PER_HOUR);
    expect(await s.claimRateSlot(h, "2026-10-15T09")).toBe(true);
    expect(await s.claimRateSlot(ipHash("203.0.113.8", "2026-10-15"), "2026-10-15T08")).toBe(true);
  });

  it("never stores the raw IP and rotates the hash daily", () => {
    expect(ipHash("203.0.113.7", "2026-10-15")).not.toContain("203");
    expect(ipHash("203.0.113.7", "2026-10-15")).not.toBe(ipHash("203.0.113.7", "2026-10-16"));
  });

  it("judge code and bench secret compare in constant time and fail closed", () => {
    expect(isJudge("abc", "abc")).toBe(true);
    expect(isJudge("abd", "abc")).toBe(false);
    expect(isJudge("abc", undefined)).toBe(false);
    expect(isBench(null, "s")).toBe(false);
  });
});

describe("extraction spans are located by code", () => {
  const ad = "Dibutuhkan CS online untuk Kamboja. Gaji Rp 15 jt/bulan, tanpa pengalaman.\nVisa turis diurus.";
  it("finds exact and normalised pieces, and drops what is not in the ad", () => {
    expect(locate(ad, "Kamboja")).toEqual({ text: "Kamboja", start: ad.indexOf("Kamboja"), end: ad.indexOf("Kamboja") + 7 });
    expect(locate(ad, "visa  TURIS diurus")?.text).toBe("Visa turis diurus");
    expect(locate(ad, "Myanmar")).toBeNull();
    const ex = toExtraction(ad, { is_job_offer: true, company: "PT Palsu", recruiter: null, phones: [], destination: "Kamboja", job: "CS online", visa: "Visa turis", fees: [], promises: ["Gaji Rp 15 jt/bulan", "tanpa pengalaman", "bonus besar"] });
    expect(ex.company).toBeUndefined();
    expect(ex.droppedFields).toEqual(["company", "promises"]);
    expect(ex.promises.map((p) => p.text)).toEqual(["Gaji Rp 15 jt/bulan", "tanpa pengalaman"]);
  });

  it("validates the reply shape", () => {
    expect(validateExtraction({ is_job_offer: true, company: null, phones: [], fees: [], promises: [] })).toBeNull();
    expect(validateExtraction({ is_job_offer: "yes" })).toMatch(/boolean/);
    expect(validateExtraction({ is_job_offer: true, phones: [1] })).toMatch(/phones/);
  });
});

describe("objectStore operations", () => {
  const cfg: StorageConfig = {
    s3Endpoint: "https://storage.eu-west1.nebius.cloud",
    bucket: "test-bucket",
    region: "eu-west1",
    s3AccessKeyId: "key",
    s3SecretAccessKey: "secret",
  };

  function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
    let callIndex = 0;
    return (async (_url: string | URL | Request, _init?: RequestInit) => {
      const resp = responses[Math.min(callIndex++, responses.length - 1)];
      return new Response(JSON.stringify(resp.body), { status: resp.status ?? 200 });
    }) as typeof fetch;
  }

  it("putPack and getPack round-trip evidence packs", async () => {
    const now = new Date().toISOString();
    const pack: EvidencePack = {
      id: "aaaabbbbccccddddeeeefffff2",
      createdAt: now,
      mode: "live",
      stage: "full",
      lang: "id",
      adSha256: "hash",
      adTextMasked: "masked ad",
      extraction: null,
      flags: [],
      tavily: [],
      lines: [],
      verdict: "STOP",
      rule: "test rule",
      verifySteps: [],
      messageId: "msg1",
      messageEn: "msg",
      explanationEn: "explain",
      messageSource: null,
      receipt: { models: [], tfCalls: 0, tfTokens: 0, tavilyCredits: 0, ms: 0, failedSteps: [], tf: [] },
      done: true,
    };
    const store = objectStore(cfg, fakeFetch([
      { body: {} }, // PUT response
      { body: pack }, // GET response
    ]));
    await store.putPack(pack);
    const retrieved = await store.getPack(pack.id);
    expect(retrieved).toEqual(pack);
  });

  it("getPack returns null for missing or invalid case IDs", async () => {
    const store = objectStore(cfg, fakeFetch([{ body: null }]));
    expect(await store.getPack("invalid-id")).toBeNull();
    expect(await store.getPack("aaaabbbbccccddddeeeefffff2")).toBeNull();
  });

  it("putSample and listSamples manage recorded samples", async () => {
    const now = new Date().toISOString();
    const receipt = { models: [], tfCalls: 0, tfTokens: 0, tavilyCredits: 0, ms: 0, failedSteps: [], tf: [] };
    const pack1: EvidencePack = {
      id: "aaaabbbbccccddddeeeefffff2",
      createdAt: now,
      mode: "live",
      stage: "full",
      lang: "id",
      adSha256: "hash1",
      adTextMasked: "ad1",
      extraction: null,
      flags: [],
      tavily: [],
      lines: [],
      verdict: "VERIFY_FIRST",
      rule: "",
      verifySteps: [],
      messageId: "m1",
      messageEn: "m1en",
      explanationEn: "e1",
      messageSource: null,
      receipt,
      done: true,
    };
    const pack2: EvidencePack = {
      id: "aaaabbbbccccddddeeeefffff3",
      createdAt: now,
      mode: "live",
      stage: "full",
      lang: "id",
      adSha256: "hash2",
      adTextMasked: "ad2",
      extraction: null,
      flags: [],
      tavily: [],
      lines: [],
      verdict: "NO_RED_FLAGS_FOUND",
      rule: "",
      verifySteps: [],
      messageId: "m2",
      messageEn: "m2en",
      explanationEn: "e2",
      messageSource: null,
      receipt,
      done: true,
    };
    const store = objectStore(cfg, fakeFetch([
      { body: {} }, // putSample 1
      { body: {} }, // putSample 2
      { body: "<ListBucketResult><Contents><Key>samples/s1.json</Key><Key>samples/s2.json</Key></Contents></ListBucketResult>" }, // LIST
      { body: pack1 }, // getJson for s1
      { body: pack2 }, // getJson for s2
    ]));
    await store.putSample("s1", pack1);
    await store.putSample("s2", pack2);
    const samples = await store.listSamples();
    expect(samples).toHaveLength(2);
    expect(samples[0].verdict).toBe("VERIFY_FIRST");
    expect(samples[1].verdict).toBe("NO_RED_FLAGS_FOUND");
  });

  it("claimRateSlot succeeds on first available slot", async () => {
    let callIndex = 0;
    const customFetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        // LIST request: show 1 existing slot
        return new Response("<ListBucketResult><Contents><Key>rate/h/2026-10-15T08/0.json</Key></Contents></ListBucketResult>", { status: 200 });
      }
      // Second slot creation (n=1) succeeds
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    const store = objectStore(cfg, customFetch);
    const result = await store.claimRateSlot("hashedip123", "2026-10-15T08");
    expect(result).toBe(true);
  });

  it("claimRateSlot returns false when all slots are taken", async () => {
    let callIndex = 0;
    const customFetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        // LIST request: show all 60 slots already exist
        const keys = Array.from({ length: RATE_LIMIT_PER_HOUR }, (_, i) => `<Key>rate/h/2026-10-15T08/${i}.json</Key>`).join("");
        return new Response(`<ListBucketResult><Contents>${keys}</Contents></ListBucketResult>`, { status: 200 });
      }
      // All putJsonConditional attempts fail with 412 (precondition failed)
      return new Response(JSON.stringify({}), { status: 412 });
    }) as typeof fetch;
    const store = objectStore(cfg, customFetch);
    const result = await store.claimRateSlot("hashedip123", "2026-10-15T08");
    expect(result).toBe(false);
  });

  it("putReceipt and recentReceipts persist and retrieve integration receipts", async () => {
    const r1: IntegrationReceipt = {
      at: new Date("2026-10-15T12:00:00Z").toISOString(),
      mode: "live",
      models: ["m1"],
      tfCalls: 1,
      tfTokens: 100,
      tavily: [{ method: "search", purpose: "company", credits: 1, ms: 100, access: "key" }],
      storagePrefix: "cases/",
      ms: 500,
      verdict: "STOP",
    };
    const r2: IntegrationReceipt = {
      at: new Date("2026-10-15T13:00:00Z").toISOString(),
      mode: "live",
      models: ["m1"],
      tfCalls: 1,
      tfTokens: 50,
      tavily: [],
      storagePrefix: "cases/",
      ms: 300,
      verdict: "VERIFY_FIRST",
    };
    const store = objectStore(cfg, fakeFetch([
      { body: {} }, // putReceipt 1
      { body: {} }, // putReceipt 2
      { body: "<ListBucketResult><Contents><Key>receipts/9999999999999.json</Key><Key>receipts/9999999998999.json</Key></Contents></ListBucketResult>" }, // LIST
      { body: r2 }, // getJson for newer receipt (9999999999999)
      { body: r1 }, // getJson for older receipt (9999999998999)
    ]));
    await store.putReceipt(r1);
    await store.putReceipt(r2);
    const recent = await store.recentReceipts(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].ms).toBe(300);
    expect(recent[1].ms).toBe(500);
  });

  it("addCredits increments monthly balance with CAS retry", async () => {
    let callIndex = 0;
    const customFetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        // getJsonVersioned response - must have etag header
        return new Response('{"credits":100,"updatedAt":"2026-10-01T00:00:00Z"}', {
          status: 200,
          headers: { etag: '"v1"' },
        });
      }
      // putJsonConditional response
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    const store = objectStore(cfg, customFetch);
    const result = await store.addCredits("2026-10", 50);
    expect(result).toBe(150);
  });

  it("addCredits creates new month when none exists", async () => {
    let callIndex = 0;
    const customFetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        // getJsonVersioned returns null for missing
        return new Response("", { status: 404 });
      }
      // putJsonConditional with ifNoneMatch succeeds
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    const store = objectStore(cfg, customFetch);
    const result = await store.addCredits("2026-11", 100);
    expect(result).toBe(100);
  });

  it("getCredits retrieves monthly balance", async () => {
    const store = objectStore(cfg, fakeFetch([
      { body: { credits: 250, updatedAt: "2026-10-15T00:00:00Z" } }, // getJson
    ]));
    const credits = await store.getCredits("2026-10");
    expect(credits).toBe(250);
  });

  it("getCredits returns 0 for missing month", async () => {
    const store = objectStore(cfg, fakeFetch([
      { body: null }, // getJson returns null
    ]));
    const credits = await store.getCredits("2026-11");
    expect(credits).toBe(0);
  });

  it("isCaseId validates case ID format", () => {
    expect(isCaseId("aaaabbbbccccddddeeeefffff2")).toBe(true); // Base32: a-z, 2-7
    expect(isCaseId("aaaabbbbccccddddeeeefffff7")).toBe(true); // Highest digit valid
    expect(isCaseId("aaaabbbbccccddddeeeefffff0")).toBe(false); // 0 not in base32
    expect(isCaseId("aaaabbbbccccddddeeeefffff1")).toBe(false); // 1 not in base32
    expect(isCaseId("aaaabbbbccccddddeeeefffff9")).toBe(false); // 9 not in base32
    expect(isCaseId("aaaabbbbccccddddeeeefffff")).toBe(false); // Too short
    expect(isCaseId("AAAABBBBCCCCDDDDEEEEFFFFF2")).toBe(false); // Uppercase not allowed
  });
});
