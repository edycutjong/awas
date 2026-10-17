/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/nebius/storage", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    getJson: vi.fn(), getJsonVersioned: vi.fn(), listObjects: vi.fn(), putJson: vi.fn(), putJsonConditional: vi.fn(),
  };
});

import * as storage from "@/lib/nebius/storage";
import { clientIp, getStore, hourKey, isBench, isJudge, localStore, monthKey, objectStore, toIntegrationReceipt, ipHash } from "@/lib/store";

const m = storage as any;
const cfg = { bucket: "b", region: "r", s3Endpoint: "https://e", s3AccessKeyId: "a", s3SecretAccessKey: "s" };
const CASE = "a".repeat(26);
const pack: any = { id: CASE, createdAt: "2026-10-18T00:00:00.000Z", mode: "live", verdict: "STOP", tavily: [{ method: "search", purpose: "p", credits: 1, ms: 2, access: "key", extra: 1 }] };
const rec = (at: string): any => ({ at, mode: "live", models: [], tfCalls: 0, tfTokens: 0, tavily: [], storagePrefix: "cases/", ms: 1, verdict: "STOP" });

afterEach(() => vi.clearAllMocks());

describe("objectStore (storage mocked)", () => {
  it("passes through puts and gates getPack on the id shape", async () => {
    const s = objectStore(cfg);
    await s.putPack(pack);
    await s.putSample("x", pack);
    await s.putReceipt(rec("2026-10-18T00:00:00.000Z"));
    expect(m.putJson).toHaveBeenCalledTimes(3);
    m.getJson.mockResolvedValueOnce(pack);
    expect(await s.getPack(CASE)).toBe(pack);
    expect(await s.getPack("bad")).toBeNull();
  });

  it("listSamples keeps only json keys, sorted, dropping nulls", async () => {
    m.listObjects.mockResolvedValue(["samples/b.json", "samples/a.json", "samples/readme.txt"]);
    m.getJson.mockImplementation(async (_c: unknown, k: string) => (k.endsWith("a.json") ? { id: "A" } : null));
    expect(await objectStore(cfg).listSamples()).toEqual([{ id: "A" }]);
  });

  it("claimRateSlot starts after existing slots and retries on a lost race", async () => {
    m.listObjects.mockResolvedValue(["x", "y"]);
    m.putJsonConditional.mockResolvedValueOnce({ ok: false, status: 412 }).mockResolvedValueOnce({ ok: true, etag: null });
    expect(await objectStore(cfg).claimRateSlot("ip", "h")).toBe(true);
    expect(m.putJsonConditional).toHaveBeenCalledTimes(2);
  });

  it("claimRateSlot is false when the hour is full", async () => {
    m.listObjects.mockResolvedValue(new Array(60).fill("k"));
    expect(await objectStore(cfg).claimRateSlot("ip", "h")).toBe(false);
  });

  it("recentReceipts slices the newest n and drops nulls", async () => {
    m.listObjects.mockResolvedValue(["receipts/3", "receipts/1", "receipts/2"]);
    m.getJson.mockImplementation(async (_c: unknown, k: string) => (k === "receipts/2" ? null : { k }));
    expect(await objectStore(cfg).recentReceipts(2)).toEqual([{ k: "receipts/1" }]);
  });

  it("addCredits: create, update with etag, and exhausted-retries fallback", async () => {
    m.getJsonVersioned.mockResolvedValueOnce(null);
    m.putJsonConditional.mockResolvedValueOnce({ ok: true, etag: "e" });
    expect(await objectStore(cfg).addCredits("2026-10", 5)).toBe(5);
    expect(m.putJsonConditional.mock.calls[0][3]).toEqual({ ifNoneMatch: "*" });

    m.getJsonVersioned.mockResolvedValueOnce({ value: { credits: 10 }, etag: "E" });
    m.putJsonConditional.mockResolvedValueOnce({ ok: true, etag: "e" });
    expect(await objectStore(cfg).addCredits("2026-10", 5)).toBe(15);
    expect(m.putJsonConditional.mock.calls[1][3]).toEqual({ ifMatch: "E" });

    m.getJsonVersioned.mockResolvedValue({ value: { credits: 1 }, etag: null });
    m.putJsonConditional.mockResolvedValue({ ok: false, status: 412 });
    m.getJson.mockResolvedValueOnce({ credits: 77 });
    expect(await objectStore(cfg).addCredits("2026-10", 1)).toBe(77);
    m.getJson.mockResolvedValueOnce(null);
    expect(await objectStore(cfg).addCredits("2026-10", 1)).toBe(0);
  });

  it("getCredits defaults to 0", async () => {
    m.getJson.mockResolvedValueOnce({ credits: 4 });
    expect(await objectStore(cfg).getCredits("m")).toBe(4);
    m.getJson.mockResolvedValueOnce(null);
    expect(await objectStore(cfg).getCredits("m")).toBe(0);
  });
});

describe("localStore", () => {
  const fresh = () => localStore(mkdtempSync(path.join(tmpdir(), "awas-local-")));
  it("round-trips packs, samples, receipts and credits", async () => {
    const s = fresh();
    expect(s.kind).toBe("local");
    expect(await s.getPack(CASE)).toBeNull();
    expect(await s.getPack("bad")).toBeNull();
    await s.putPack(pack);
    expect(await s.getPack(CASE)).toEqual(pack);
    expect(await s.listSamples()).toEqual([]);
    await s.putSample("one", pack);
    expect(await s.listSamples()).toEqual([pack]);
    expect(await s.recentReceipts(5)).toEqual([]);
    await s.putReceipt(rec("2026-10-18T00:00:00.000Z"));
    await s.putReceipt(rec("2026-10-19T00:00:00.000Z"));
    const rs = await s.recentReceipts(5);
    expect(rs.map((r) => r.at)).toEqual(["2026-10-19T00:00:00.000Z", "2026-10-18T00:00:00.000Z"]);
    expect(await s.recentReceipts(1)).toHaveLength(1);
    expect(await s.getCredits("2026-10")).toBe(0);
    expect(await s.addCredits("2026-10", 3)).toBe(3);
    expect(await s.addCredits("2026-10", 4)).toBe(7);
    expect(await s.getCredits("2026-10")).toBe(7);
  });
  it("defaults its root to ./data without touching it until used", () => {
    expect(localStore().kind).toBe("local");
  });
});

describe("getStore", () => {
  it("caches the first store it builds", async () => {
    vi.resetModules();
    const mod = await import("@/lib/store");
    const a = mod.getStore();
    expect(a.kind).toBe("local");
    expect(mod.getStore()).toBe(a);
    vi.stubEnv("NEBIUS_BUCKET", "b");
    vi.stubEnv("NEBIUS_S3_ACCESS_KEY_ID", "a");
    vi.stubEnv("NEBIUS_S3_SECRET_ACCESS_KEY", "s");
    vi.resetModules();
    expect((await import("@/lib/store")).getStore().kind).toBe("object-storage");
    vi.unstubAllEnvs();
    expect(getStore().kind).toBeDefined();
  });
});

describe("helpers", () => {
  it("clientIp prefers x-forwarded-for, then x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": " 3.3.3.3 " }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": " " }))).toBe("unknown");
  });
  it("judge and bench use env defaults", () => {
    vi.stubEnv("AWAS_JUDGE_CODE", "jj");
    vi.stubEnv("AWAS_BENCH_SECRET", "bb");
    expect(isJudge(" jj ")).toBe(true);
    expect(isBench("bb")).toBe(true);
    expect(isBench("b")).toBe(false);
    vi.unstubAllEnvs();
    expect(isJudge("jj")).toBe(false);
    expect(ipHash("1.1.1.1", "d")).toHaveLength(32);
    vi.stubEnv("AWAS_RATE_SALT", "x");
    expect(ipHash("1.1.1.1", "d")).not.toBe(ipHash("1.1.1.1", "d", "awas-rate"));
    vi.unstubAllEnvs();
  });
  it("hourKey / monthKey / toIntegrationReceipt", () => {
    const d = new Date("2026-10-18T05:06:07Z");
    expect(hourKey(d)).toBe("2026-10-18T05");
    expect(monthKey(d)).toBe("2026-10");
    expect(hourKey()).toMatch(/^\d{4}-\d\d-\d\dT\d\d$/);
    expect(monthKey()).toMatch(/^\d{4}-\d\d$/);
    const r = toIntegrationReceipt(pack, { models: ["m"], tfCalls: 1, tfTokens: 2, ms: 3 } as any);
    expect(r).toMatchObject({ at: pack.createdAt, models: ["m"], storagePrefix: "cases/", tavily: [{ method: "search", purpose: "p", credits: 1, ms: 2, access: "key" }] });
    expect((r.tavily[0] as any).extra).toBeUndefined();
  });
});
