/**
 * Nebius Object Storage (S3-compatible) client, copied from faultline (same author).
 *
 * In Awas it holds three things: write-once evidence packs, the per-IP rate slots, and the
 * recorded sample cases. A rate slot is a conditional create (`If-None-Match: "*"`): two
 * requests racing for the same slot cannot both win, so the limit holds without a lock server.
 */

import { presignUrl, signRequest } from "./sigv4";
import type { StorageConfig as NebiusConfig } from "./config";

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

function endpointHost(endpoint: string): string {
  return new URL(endpoint).host;
}

/**
 * Path-style addressing (`https://storage.<region>.nebius.cloud/<bucket>/<key>`) is what the
 * Nebius docs document, and it avoids the DNS propagation delay a new virtual-hosted bucket
 * would hit.
 */
function objectUrl(config: NebiusConfig, key: string): string {
  const base = config.s3Endpoint.replace(/\/+$/, "");
  return `${base}/${config.bucket}/${key.replace(/^\/+/, "")}`;
}

async function s3Request(
  config: NebiusConfig,
  method: string,
  key: string,
  body: string,
  query: Record<string, string>,
  fetchImpl: typeof fetch,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const url = objectUrl(config, key);
  const path = new URL(url).pathname;

  const signed = signRequest({
    method,
    path: decodeURIComponent(path),
    query,
    // Conditional headers are signed along with Host, so they cannot be stripped in transit
    // and turn a compare-and-swap into a blind overwrite.
    headers: { Host: endpointHost(config.s3Endpoint), ...extraHeaders },
    payload: body,
    region: config.region,
    service: "s3",
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
  });

  // `Host` is signed but must not be sent explicitly — fetch sets it, and a duplicate is a
  // protocol error in undici.
  const headers = { ...signed.headers };
  delete headers.Host;

  const qs = new URLSearchParams(query).toString();
  return fetchImpl(qs ? `${url}?${qs}` : url, {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body }),
  });
}

/** Read an object. Returns null for a missing key. */
export async function getObject(
  config: NebiusConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await s3Request(config, "GET", key, "", {}, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new StorageError(`GET ${key} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return res.text();
}

/** Read and parse a JSON object, returning null when absent or unparseable. */
export async function getJson<T>(
  config: NebiusConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T | null> {
  const text = await getObject(config, key, fetchImpl);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Writers PUT whole documents, so a torn read should be impossible. If one happens
    // anyway it is treated as absent rather than thrown.
    return null;
  }
}

export async function putObject(
  config: NebiusConfig,
  key: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await s3Request(config, "PUT", key, body, {}, fetchImpl);
  if (!res.ok) {
    throw new StorageError(`PUT ${key} failed: ${res.status} ${res.statusText}`, res.status);
  }
}

export async function putJson(
  config: NebiusConfig,
  key: string,
  value: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await putObject(config, key, JSON.stringify(value, null, 2), fetchImpl);
}

export async function headObject(
  config: NebiusConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await s3Request(config, "HEAD", key, "", {}, fetchImpl);
  return res.ok;
}

/** List object keys under a prefix. Follows continuation tokens to completion. */
export async function listObjects(
  config: NebiusConfig,
  prefix: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const query: Record<string, string> = { "list-type": "2", prefix };
    if (continuationToken) query["continuation-token"] = continuationToken;

    const res = await s3Request(config, "GET", "", "", query, fetchImpl);
    if (!res.ok) {
      throw new StorageError(
        `LIST ${prefix} failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }

    const xml = await res.text();
    for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
      const key = match[1];
      if (key) keys.push(decodeXmlEntities(key));
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    continuationToken = truncated
      ? (xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] ?? undefined)
      : undefined;
  } while (continuationToken);

  return keys;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** One pass, so a key holding a literal "&lt;" (sent as "&amp;lt;") is not decoded twice. */
export function decodeXmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => XML_ENTITIES[name]);
}

/** A stored object together with the ETag a conditional replace must quote back. */
export interface Versioned<T> {
  value: T;
  etag: string | null;
}

/** Read an object and its ETag. Returns null for a missing key. */
export async function getObjectVersioned(
  config: NebiusConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Versioned<string> | null> {
  const res = await s3Request(config, "GET", key, "", {}, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new StorageError(`GET ${key} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return { value: await res.text(), etag: res.headers.get("etag") };
}

/**
 * Read and parse a JSON object with its ETag.
 *
 * Unlike `getJson`, unparseable content THROWS: this is used for records the app itself
 * wrote, where a torn document is corruption to surface.
 */
export async function getJsonVersioned<T>(
  config: NebiusConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Versioned<T> | null> {
  const object = await getObjectVersioned(config, key, fetchImpl);
  if (object === null) return null;
  try {
    return { value: JSON.parse(object.value) as T, etag: object.etag };
  } catch {
    throw new StorageError(`GET ${key} returned a document that is not JSON`, 500);
  }
}

/** Create-only (`ifNoneMatch: "*"`) or replace-if-unchanged (`ifMatch: <etag>`). */
export type WriteCondition = { ifNoneMatch: "*" } | { ifMatch: string };

export type ConditionalResult = { ok: true; etag: string | null } | { ok: false; status: number };

/**
 * A conditional PUT — the only primitive the control loop needs to be safe without a lock
 * server. Losing the condition is an ordinary outcome, not an error: 412 means the object
 * exists (or changed) and 409 means a concurrent conditional write to the same key is in
 * flight. Either way another writer won, and the caller re-reads instead of overwriting.
 */
export async function putObjectConditional(
  config: NebiusConfig,
  key: string,
  body: string,
  condition: WriteCondition,
  fetchImpl: typeof fetch = fetch,
): Promise<ConditionalResult> {
  const header: Record<string, string> =
    "ifNoneMatch" in condition
      ? { "If-None-Match": condition.ifNoneMatch }
      : { "If-Match": condition.ifMatch };
  const res = await s3Request(config, "PUT", key, body, {}, fetchImpl, header);
  if (res.status === 412 || res.status === 409) return { ok: false, status: res.status };
  if (!res.ok) {
    throw new StorageError(`PUT ${key} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return { ok: true, etag: res.headers.get("etag") };
}

export async function putJsonConditional(
  config: NebiusConfig,
  key: string,
  value: unknown,
  condition: WriteCondition,
  fetchImpl: typeof fetch = fetch,
): Promise<ConditionalResult> {
  return putObjectConditional(config, key, JSON.stringify(value, null, 2), condition, fetchImpl);
}

/**
 * A URL that lets its holder PUT exactly one key until it expires — and nothing else.
 *
 * This is what the bench job receives instead of a credential: it can write its own result
 * file and nothing else, so a compromised job image cannot read or overwrite evidence packs.
 */
export function presignPut(config: NebiusConfig, key: string, expiresSeconds: number, date?: Date): string {
  const url = new URL(objectUrl(config, key));
  return presignUrl({
    method: "PUT",
    origin: url.origin,
    path: decodeURIComponent(url.pathname),
    region: config.region,
    service: "s3",
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    expiresSeconds,
    date,
  }).url;
}

/** Object key layout. Centralised so no two writers can drift apart. */
export const keys = {
  /** Evidence pack. Expires after 75 days (bucket lifecycle rule on `cases/`). */
  pack: (caseId: string) => `cases/${caseId}.json`,
  /** n-th live run from one hashed IP in one hour, claimed with If-None-Match. Expires after 1 day. */
  rateSlot: (ipHash: string, hour: string, n: number) => `rate/${ipHash}/${hour}/${n}.json`,
  /** A recorded real run shown on /judge. Exempt from expiry. */
  sample: (slug: string) => `samples/${slug}.json`,
  /** Rows written by the bench job through a presigned PUT. */
  benchResult: (runId: string) => `bench/${runId}.jsonl`,
  /** Monthly Tavily credit counter for the spend alarm. */
  creditMonth: (month: string) => `ledger/tavily-${month}.json`,
} as const;
