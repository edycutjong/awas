import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeToken, getAccessToken, NebiusAuthError, resetTokenCache, signJwt } from "@/lib/nebius/auth";
import type { NebiusConfig } from "@/lib/nebius/config";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const CFG = {
  serviceAccountId: "sa-test",
  authKeyId: "key-test",
  privateKeyPem: PEM,
  projectId: "proj-test",
  subnetId: "subnet-test",
  region: "eu-west1",
  bucket: "test-bucket",
  s3Endpoint: "https://storage.eu-west1.nebius.cloud",
  s3AccessKeyId: "ak",
  s3SecretAccessKey: "sk",
  workerImage: "python:3.11",
  workerPrebuilt: false,
  maxConcurrentJobs: 1,
} as unknown as NebiusConfig;

const b64u = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString());

describe("signJwt", () => {
  it("produces a verifiable RS256 JWT with the right claims", () => {
    const jwt = signJwt(CFG, 1000);
    const [h, p, s] = jwt.split(".") as [string, string, string];
    expect(b64u(h)).toEqual({ alg: "RS256", typ: "JWT", kid: "key-test" });
    expect(b64u(p)).toEqual({ iss: "sa-test", sub: "sa-test", iat: 1000, exp: 1300 });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("defaults iat to now", () => {
    const [, p] = signJwt(CFG).split(".") as [string, string];
    const payload = b64u(p);
    expect(Math.abs(payload.iat - Date.now() / 1000)).toBeLessThan(5);
  });
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("token exchange", () => {
  beforeEach(() => resetTokenCache());
  afterEach(() => vi.useRealTimers());

  it("posts the token-exchange grant and returns the token with its expiry", async () => {
    const f = vi.fn(async () => ok({ access_token: "T", expires_in: 100, token_type: "Bearer" }));
    const t = await exchangeToken(CFG, f as never);
    expect(t.token).toBe("T");
    expect(t.expiresAtMs).toBeGreaterThan(Date.now() + 90_000);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("nebius.com/oauth2/token/exchange");
    expect(String(init.body)).toContain("subject_token_type=urn%3Aietf%3Aparams%3Aoauth%3Atoken-type%3Ajwt");
  });

  it("includes the response body in a failed exchange", async () => {
    const f = async () => new Response("bad kid", { status: 401, statusText: "Unauthorized" });
    const err = await exchangeToken(CFG, f as never).catch((e) => e);
    expect(err).toBeInstanceOf(NebiusAuthError);
    expect(err.status).toBe(401);
    expect(err.message).toContain("bad kid");
  });

  it("truncates long error bodies to 500 chars", async () => {
    const longError = "x".repeat(1000);
    const f = async () => new Response(longError, { status: 500, statusText: "Error" });
    const err = await exchangeToken(CFG, f as never).catch((e) => e);
    expect(err).toBeInstanceOf(NebiusAuthError);
    expect(err.message.length).toBeLessThan(600);
  });

  it("survives an unreadable error body", async () => {
    const res = { ok: false, status: 500, statusText: "Boom", text: async () => { throw new Error("x"); } };
    const err = await exchangeToken(CFG, (async () => res) as never).catch((e) => e);
    expect(err).toBeInstanceOf(NebiusAuthError);
    expect(err.message).toContain("500 Boom");
  });

  it("rejects a response with no access_token as 502", async () => {
    const err = await exchangeToken(CFG, (async () => ok({})) as never).catch((e) => e);
    expect(err).toBeInstanceOf(NebiusAuthError);
    expect(err.status).toBe(502);
    expect(err.message).toContain("no access_token");
  });

  it("caches the token and re-mints inside the refresh margin", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const f = vi.fn(async () => {
      callCount++;
      return ok({ access_token: `T${callCount}`, expires_in: 3600 });
    });
    expect(await getAccessToken(CFG, f as never)).toBe("T1");
    expect(await getAccessToken(CFG, f as never)).toBe("T1");
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(51 * 60 * 1000); // advance past 50-min mark to trigger refresh
    expect(await getAccessToken(CFG, f as never)).toBe("T2");
  });

  it("returns cached token when not near expiry", async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => ok({ access_token: "T1", expires_in: 36000 }));
    expect(await getAccessToken(CFG, f as never)).toBe("T1");
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(await getAccessToken(CFG, f as never)).toBe("T1");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("resets the cache", async () => {
    const f = vi.fn(async () => ok({ access_token: "T1", expires_in: 3600 }));
    await getAccessToken(CFG, f as never);
    resetTokenCache();
    await getAccessToken(CFG, f as never);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("NebiusAuthError", () => {
  it("is an Error with a status code", () => {
    const err = new NebiusAuthError("test", 401);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("NebiusAuthError");
    expect(err.message).toBe("test");
    expect(err.status).toBe(401);
  });
});
