/**
 * Nebius Object Storage (S3-compatible) client error paths and edge cases.
 */
import { describe, expect, it } from "vitest";
import { getJson, getObject, listObjects, putJson, putObject, StorageError, decodeXmlEntities } from "@/lib/nebius/storage";
import type { StorageConfig } from "@/lib/nebius/config";

const cfg: StorageConfig = {
  s3Endpoint: "https://storage.eu-west1.nebius.cloud",
  bucket: "test-bucket",
  region: "eu-west1",
  s3AccessKeyId: "key",
  s3SecretAccessKey: "secret",
};

function fakeFetch(response: { status?: number; body: unknown; headers?: Record<string, string> }): typeof fetch {
  return (async (_url: string | URL | Request, _init?: RequestInit) => {
    if (typeof response.body === "string") {
      return new Response(response.body, { status: response.status ?? 200, headers: response.headers });
    }
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200, headers: response.headers });
  }) as typeof fetch;
}

describe("Object Storage errors", () => {
  it("getObject throws on non-404 errors", async () => {
    const fetch = fakeFetch({ status: 403, body: { error: "forbidden" } });
    await expect(getObject(cfg, "key", fetch)).rejects.toThrow(StorageError);
  });

  it("getJson returns null for 404", async () => {
    const fetch = fakeFetch({ status: 404, body: {} });
    const result = await getJson(cfg, "key", fetch);
    expect(result).toBeNull();
  });

  it("getJson returns null for malformed JSON", async () => {
    const mockFetch = async (_url: string | URL | Request, _init?: RequestInit) => new Response("not json", { status: 200 });
    const result = await getJson(cfg, "key", mockFetch as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  it("putObject throws on error", async () => {
    const fetch = fakeFetch({ status: 500, body: { error: "server error" } });
    await expect(putObject(cfg, "key", "data", fetch)).rejects.toThrow(StorageError);
  });

  it("putJson serializes and sends objects", async () => {
    let received = "";
    const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      received = String(init?.body);
      return new Response(JSON.stringify({}), { status: 200 });
    };
    await putJson(cfg, "key", { a: 1, b: 2 }, mockFetch as unknown as typeof fetch);
    const parsed = JSON.parse(received);
    expect(parsed).toEqual({ a: 1, b: 2 });
  });

  it("listObjects handles empty list", async () => {
    const fetch = fakeFetch({ body: "<ListBucketResult><Contents></Contents></ListBucketResult>" });
    const keys = await listObjects(cfg, "prefix/", fetch);
    expect(keys).toEqual([]);
  });

  it("listObjects parses multiple keys and continuation tokens", async () => {
    let callCount = 0;
    const mockFetch = async (_url: string | URL | Request, _init?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          `<ListBucketResult>
          <Contents><Key>prefix/file1.json</Key></Contents>
          <Contents><Key>prefix/file2.json</Key></Contents>
          <IsTruncated>true</IsTruncated>
          <NextContinuationToken>token123</NextContinuationToken>
        </ListBucketResult>`,
          { status: 200 }
        );
      }
      // Second page
      return new Response(
        `<ListBucketResult>
        <Contents><Key>prefix/file3.json</Key></Contents>
        <IsTruncated>false</IsTruncated>
      </ListBucketResult>`,
        { status: 200 }
      );
    };
    const keys = await listObjects(cfg, "prefix/", mockFetch as unknown as typeof fetch);
    expect(keys).toEqual(["prefix/file1.json", "prefix/file2.json", "prefix/file3.json"]);
  });

  it("listObjects throws on non-200 response", async () => {
    const fetch = fakeFetch({ status: 500, body: { error: "server error" } });
    await expect(listObjects(cfg, "prefix/", fetch)).rejects.toThrow(StorageError);
  });

  it("decodeXmlEntities unescapes HTML entities", () => {
    expect(decodeXmlEntities("hello&amp;world")).toBe("hello&world");
    expect(decodeXmlEntities("a&lt;b&gt;c")).toBe("a<b>c");
    expect(decodeXmlEntities("&quot;quoted&quot;")).toBe('"quoted"');
    expect(decodeXmlEntities("&apos;apostrophe&apos;")).toBe("'apostrophe'");
    expect(decodeXmlEntities("no entities here")).toBe("no entities here");
  });
});
