/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import {
  getJsonVersioned, getObjectVersioned, headObject, listObjects, presignGet, presignPut, putJsonConditional, putObjectConditional,
  StorageError,
} from "@/lib/nebius/storage";
import type { NebiusConfig } from "@/lib/nebius/config";

const cfg = { s3Endpoint: "https://storage.eu-west1.nebius.cloud", bucket: "bk", region: "eu-west1", s3AccessKeyId: "key", s3SecretAccessKey: "secret" } as NebiusConfig;
const seq = (...rs: Response[]) => {
  const f = vi.fn();
  rs.forEach((r) => f.mockResolvedValueOnce(r));
  return f as unknown as typeof fetch;
};

describe("headObject", () => {
  it("reflects res.ok", async () => {
    expect(await headObject(cfg, "k", seq(new Response(null, { status: 200 })))).toBe(true);
    expect(await headObject(cfg, "k", seq(new Response(null, { status: 404 })))).toBe(false);
  });
});

describe("listObjects", () => {
  it("follows continuation tokens and decodes keys", async () => {
    const f = seq(
      new Response("<Key>a&amp;b</Key><Key></Key><IsTruncated>true</IsTruncated><NextContinuationToken>T1</NextContinuationToken>"),
      new Response("<Key>c</Key><IsTruncated>false</IsTruncated>"),
    );
    expect(await listObjects(cfg, "p/", f)).toEqual(["a&b", "c"]);
    expect(String((f as any).mock.calls[1][0])).toContain("continuation-token=T1");
  });
  it("stops if truncated without a token", async () => {
    expect(await listObjects(cfg, "p/", seq(new Response("<IsTruncated>true</IsTruncated>")))).toEqual([]);
  });
  it("throws on a failed list", async () => {
    await expect(listObjects(cfg, "p/", seq(new Response("x", { status: 403 })))).rejects.toBeInstanceOf(StorageError);
  });
});

describe("versioned reads", () => {
  it("returns value and etag, null on 404, throws otherwise", async () => {
    expect(await getObjectVersioned(cfg, "k", seq(new Response("v", { headers: { etag: '"e"' } })))).toEqual({ value: "v", etag: '"e"' });
    expect(await getObjectVersioned(cfg, "k", seq(new Response("", { status: 404 })))).toBeNull();
    await expect(getObjectVersioned(cfg, "k", seq(new Response("", { status: 500 })))).rejects.toMatchObject({ status: 500 });
  });
  it("getJsonVersioned parses, passes null through and rejects non-JSON", async () => {
    expect(await getJsonVersioned(cfg, "k", seq(new Response('{"a":1}', { headers: { etag: "e" } })))).toEqual({ value: { a: 1 }, etag: "e" });
    expect(await getJsonVersioned(cfg, "k", seq(new Response("", { status: 404 })))).toBeNull();
    await expect(getJsonVersioned(cfg, "k", seq(new Response("nope")))).rejects.toMatchObject({ status: 500 });
  });
});

describe("conditional writes", () => {
  it("sends If-None-Match / If-Match and maps outcomes", async () => {
    const f1 = seq(new Response("", { headers: { etag: "e1" } }));
    expect(await putObjectConditional(cfg, "k", "b", { ifNoneMatch: "*" }, f1)).toEqual({ ok: true, etag: "e1" });
    expect(JSON.stringify((f1 as any).mock.calls[0][1].headers)).toContain("*");
    const f2 = seq(new Response("", { status: 412 }));
    expect(await putObjectConditional(cfg, "k", "b", { ifMatch: "E" }, f2)).toEqual({ ok: false, status: 412 });
    expect((f2 as any).mock.calls[0][1].headers["If-Match"] ?? JSON.stringify((f2 as any).mock.calls[0][1].headers)).toContain("E");
    expect(await putObjectConditional(cfg, "k", "b", { ifMatch: "E" }, seq(new Response("", { status: 409 })))).toEqual({ ok: false, status: 409 });
    await expect(putObjectConditional(cfg, "k", "b", { ifMatch: "E" }, seq(new Response("", { status: 500 })))).rejects.toBeInstanceOf(StorageError);
    expect(await putJsonConditional(cfg, "k", { a: 1 }, { ifNoneMatch: "*" }, seq(new Response("")))).toEqual({ ok: true, etag: null });
  });
});

describe("presign", () => {
  it("signs PUT and GET URLs for one key", () => {
    const d = new Date("2026-10-18T00:00:00Z");
    const put = presignPut(cfg, "bench/x.jsonl", 600, d);
    const get = presignGet(cfg, "bench/x.jsonl", 600, d);
    for (const u of [put, get]) {
      expect(u).toContain("bench/x.jsonl");
      expect(u).toContain("X-Amz-Signature=");
      expect(u).toContain("X-Amz-Expires=600");
    }
    expect(put).not.toBe(get);
    expect(presignPut(cfg, "k", 60)).toContain("X-Amz-Signature=");
    expect(presignGet(cfg, "k", 60)).toContain("X-Amz-Signature=");
  });
});

describe("keys", () => {
  it("lays out the bench result key", async () => {
    const { keys } = await import("@/lib/nebius/storage");
    expect(keys.benchResult("r1")).toBe("bench/r1.jsonl");
  });
});
