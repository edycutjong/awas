/**
 * Where evidence packs, rate slots, recorded samples and receipts live.
 *
 * Production: Nebius Object Storage (bucket lifecycle deletes `cases/` after 75 days and `rate/` after 1 day; `samples/`
 * is exempt). With no bucket env vars, a local `./data/` directory with the same key layout — a real store for a local
 * run (judges running bench mode on their machine), not a replay path. A rate slot is a conditional create in both: the
 * n-th live run from one hashed IP in one hour claims key `rate/<ip>/<hour>/<n>.json` with If-None-Match / O_EXCL, so two
 * racing requests cannot share a slot.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, open, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadStorageConfig, type StorageConfig } from "./nebius/config";
import { getJson, getJsonVersioned, keys, listObjects, putJson, putJsonConditional } from "./nebius/storage";
import type { EvidencePack, Receipt } from "./types";

/** Live runs per IP per hour (judges with the code from the Devpost testing notes are never limited). */
export const RATE_LIMIT_PER_HOUR = 60;
/** The spend alarm: 90 % of Tavily's free 1,000 credits a month. */
export const CREDIT_ALARM = 900;

export interface IntegrationReceipt {
  at: string;
  mode: EvidencePack["mode"];
  models: string[];
  tfCalls: number;
  tfTokens: number;
  tavily: { method: string; purpose: string; credits: number | null; ms: number; access: string }[];
  storagePrefix: string;
  ms: number;
  verdict: EvidencePack["verdict"];
}

export interface Store {
  kind: "object-storage" | "local";
  putPack(pack: EvidencePack): Promise<void>;
  getPack(id: string): Promise<EvidencePack | null>;
  putSample(slug: string, pack: EvidencePack): Promise<void>;
  listSamples(): Promise<EvidencePack[]>;
  claimRateSlot(ipHash: string, hour: string): Promise<boolean>;
  putReceipt(r: IntegrationReceipt): Promise<void>;
  recentReceipts(n: number): Promise<IntegrationReceipt[]>;
  addCredits(month: string, credits: number): Promise<number>;
  getCredits(month: string): Promise<number>;
}

const SAMPLE_SLUG = /^[a-z0-9-]{1,40}$/;
const CASE_ID = /^[a-z2-7]{26}$/;

export function isCaseId(id: string): boolean {
  return CASE_ID.test(id);
}

function receiptKey(r: IntegrationReceipt): string {
  // Reverse-chronological keys so a LIST returns the newest first.
  const inv = String(9_999_999_999_999 - Date.parse(r.at)).padStart(13, "0");
  return `receipts/${inv}.json`;
}

export function objectStore(cfg: StorageConfig, fetchImpl: typeof fetch = fetch): Store {
  return {
    kind: "object-storage",
    putPack: (pack) => putJson(cfg, keys.pack(pack.id), pack, fetchImpl),
    getPack: async (id) => (isCaseId(id) ? getJson<EvidencePack>(cfg, keys.pack(id), fetchImpl) : null),
    putSample: (slug, pack) => putJson(cfg, keys.sample(slug), pack, fetchImpl),
    listSamples: async () => {
      const ks = (await listObjects(cfg, "samples/", fetchImpl)).filter((k) => k.endsWith(".json")).sort();
      const packs = await Promise.all(ks.map((k) => getJson<EvidencePack>(cfg, k, fetchImpl)));
      return packs.filter((p): p is EvidencePack => p !== null);
    },
    claimRateSlot: async (ipHash, hour) => {
      const prefix = `rate/${ipHash}/${hour}/`;
      let n = (await listObjects(cfg, prefix, fetchImpl)).length;
      for (; n < RATE_LIMIT_PER_HOUR; n++) {
        const r = await putJsonConditional(cfg, keys.rateSlot(ipHash, hour, n), { at: new Date().toISOString() }, { ifNoneMatch: "*" }, fetchImpl);
        if (r.ok) return true;
      }
      return false;
    },
    putReceipt: (r) => putJson(cfg, receiptKey(r), r, fetchImpl),
    recentReceipts: async (n) => {
      const ks = (await listObjects(cfg, "receipts/", fetchImpl)).sort().slice(0, n);
      const rs = await Promise.all(ks.map((k) => getJson<IntegrationReceipt>(cfg, k, fetchImpl)));
      return rs.filter((r): r is IntegrationReceipt => r !== null);
    },
    addCredits: async (month, credits) => {
      const key = keys.creditMonth(month);
      for (let attempt = 0; attempt < 5; attempt++) {
        const cur = await getJsonVersioned<{ credits: number }>(cfg, key, fetchImpl);
        const next = { credits: (cur?.value.credits ?? 0) + credits, updatedAt: new Date().toISOString() };
        const r = await putJsonConditional(cfg, key, next, cur?.etag ? { ifMatch: cur.etag } : { ifNoneMatch: "*" }, fetchImpl);
        if (r.ok) return next.credits;
      }
      return (await getJson<{ credits: number }>(cfg, key, fetchImpl))?.credits ?? 0;
    },
    getCredits: async (month) => (await getJson<{ credits: number }>(cfg, keys.creditMonth(month), fetchImpl))?.credits ?? 0,
  };
}

export function localStore(root: string = path.join(process.cwd(), "data")): Store {
  const file = (key: string) => path.join(root, ...key.split("/"));
  const write = async (key: string, value: unknown) => {
    await mkdir(path.dirname(file(key)), { recursive: true });
    await writeFile(file(key), JSON.stringify(value, null, 2));
  };
  const read = async <T>(key: string): Promise<T | null> => {
    try {
      return JSON.parse(await readFile(file(key), "utf8")) as T;
    } catch {
      return null;
    }
  };
  const list = async (dir: string): Promise<string[]> => {
    try {
      return (await readdir(file(dir))).filter((f) => f.endsWith(".json")).sort().map((f) => `${dir}${f}`);
    } catch {
      return [];
    }
  };
  return {
    kind: "local",
    putPack: (pack) => write(keys.pack(pack.id), pack),
    getPack: async (id) => (isCaseId(id) ? read<EvidencePack>(keys.pack(id)) : null),
    putSample: (slug, pack) => write(keys.sample(slug), pack),
    listSamples: async () => (await Promise.all((await list("samples/")).map((k) => read<EvidencePack>(k)))).filter((p): p is EvidencePack => p !== null),
    claimRateSlot: async (ipHash, hour) => {
      await mkdir(path.dirname(file(keys.rateSlot(ipHash, hour, 0))), { recursive: true });
      for (let n = 0; n < RATE_LIMIT_PER_HOUR; n++) {
        try {
          const fh = await open(file(keys.rateSlot(ipHash, hour, n)), "wx");
          await fh.writeFile(JSON.stringify({ at: new Date().toISOString() }));
          await fh.close();
          return true;
        } catch {
          continue;
        }
      }
      return false;
    },
    putReceipt: (r) => write(receiptKey(r), r),
    recentReceipts: async (n) => (await Promise.all((await list("receipts/")).slice(0, n).map((k) => read<IntegrationReceipt>(k)))).filter((r): r is IntegrationReceipt => r !== null),
    addCredits: async (month, credits) => {
      const cur = (await read<{ credits: number }>(keys.creditMonth(month)))?.credits ?? 0;
      await write(keys.creditMonth(month), { credits: cur + credits, updatedAt: new Date().toISOString() });
      return cur + credits;
    },
    getCredits: async (month) => (await read<{ credits: number }>(keys.creditMonth(month)))?.credits ?? 0,
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const cfg = loadStorageConfig();
  cached = cfg.configured ? objectStore(cfg.config) : localStore();
  return cached;
}

/** sha256(ip + a daily salt) — the raw IP is never stored. */
export function ipHash(ip: string, day: string, secret: string = process.env.AWAS_RATE_SALT ?? "awas-rate"): string {
  const salt = createHash("sha256").update(`${secret}:${day}`).digest("hex");
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The judge code from the Devpost testing notes skips the per-IP slot entirely. */
export function isJudge(code: string | null | undefined, expected: string | undefined = process.env.AWAS_JUDGE_CODE): boolean {
  return !!code && !!expected && safeEqual(code.trim(), expected.trim());
}

/** Bench mode is unlocked by a secret header (scripts/bench.py); it skips the slot and enables the ablation params. */
export function isBench(secret: string | null | undefined, expected: string | undefined = process.env.AWAS_BENCH_SECRET): boolean {
  return !!secret && !!expected && safeEqual(secret.trim(), expected.trim());
}

export function hourKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 13);
}

export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function toIntegrationReceipt(pack: EvidencePack, receipt: Receipt): IntegrationReceipt {
  return {
    at: pack.createdAt,
    mode: pack.mode,
    models: receipt.models,
    tfCalls: receipt.tfCalls,
    tfTokens: receipt.tfTokens,
    tavily: pack.tavily.map((t) => ({ method: t.method, purpose: t.purpose, credits: t.credits, ms: t.ms, access: t.access })),
    storagePrefix: "cases/",
    ms: receipt.ms,
    verdict: pack.verdict,
  };
}

export { SAMPLE_SLUG };
