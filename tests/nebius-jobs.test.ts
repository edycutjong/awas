/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/nebius/auth", () => ({ getAccessToken: vi.fn(async () => "tok") }));

import { INJECTED_FILE_MAX_BYTES, NebiusApiError, cancelJob, createJob, getJob, getJobByName, listJobs, logCall, recentCalls } from "@/lib/nebius/jobs";
import type { NebiusConfig } from "@/lib/nebius/config";

const cfg = { region: "eu-west1", projectId: "project-home", subnetId: "vpcsubnet-home" } as NebiusConfig;

function res(body: unknown, init: { status?: number; statusText?: string; text?: string | Error } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status < 400, status, statusText: init.statusText ?? "",
    json: async () => body,
    text: async () => {
      if (init.text instanceof Error) throw init.text;
      return init.text ?? "";
    },
  } as unknown as Response;
}
const fakeFetch = (r: Response) => vi.fn(async () => r) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("createJob", () => {
  it("builds a minimal spec against the home target", async () => {
    const f = fakeFetch(res({ resourceId: "job-1" }));
    expect(await createJob(cfg, { name: "n", image: "img" }, f)).toBe("job-1");
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe("https://api.nebius.cloud/ai/v1/jobs");
    expect(init.headers).toEqual({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    const body = JSON.parse(init.body);
    expect(body.metadata).toEqual({ parentId: "project-home", name: "n" });
    expect(body.spec).toMatchObject({ image: "img", platform: "cpu-d3", preset: "2vcpu-8gb", subnetId: "vpcsubnet-home", timeout: "3600s" });
    expect(body.spec.disk.sizeBytes).toBe(String(32 * 1024 ** 3));
    expect(body.spec.containerCommand).toBeUndefined();
    expect(body.spec.injectedFiles).toBeUndefined();
  });

  it("builds a full spec with target, env, files and overrides", async () => {
    const f = fakeFetch(res({ resourceId: "job-2" }));
    await createJob(cfg, {
      name: "n", image: "img", target: { region: "uk", projectId: "project-t", subnetId: "vpcsubnet-t" },
      containerCommand: "python", args: "-u x", env: { A: "1" }, files: [{ containerPath: "/a.py", content: "hi" }],
      platform: "p", preset: "q", timeoutSeconds: 7200, diskSizeBytes: 5,
    }, f);
    const body = JSON.parse((f as any).mock.calls[0][1].body);
    expect(body.metadata.parentId).toBe("project-t");
    expect(body.spec).toMatchObject({
      platform: "p", preset: "q", subnetId: "vpcsubnet-t", timeout: "7200s", containerCommand: "python", args: "-u x",
      environmentVariables: [{ name: "A", value: "1" }], injectedFiles: [{ containerPath: "/a.py", content: Buffer.from("hi").toString("base64") }],
    });
    expect(body.spec.disk.sizeBytes).toBe("5");
  });

  it("floors the timeout at 3600s", async () => {
    const f = fakeFetch(res({ resourceId: "j" }));
    await createJob(cfg, { name: "n", image: "i", timeoutSeconds: 10 }, f);
    expect(JSON.parse((f as any).mock.calls[0][1].body).spec.timeout).toBe("3600s");
  });

  it.each([["", "0 bytes"], ["x".repeat(INJECTED_FILE_MAX_BYTES + 1), "too big"]])("rejects an injected file (%#)", async (content) => {
    const f = fakeFetch(res({ resourceId: "j" }));
    await expect(createJob(cfg, { name: "n", image: "i", files: [{ containerPath: "/f", content }] }, f)).rejects.toMatchObject({ status: 400, name: "NebiusApiError" });
    expect(f).not.toHaveBeenCalled();
  });

  it("throws when the operation has no resourceId", async () => {
    await expect(createJob(cfg, { name: "n", image: "i" }, fakeFetch(res({ status: { code: 1 } })))).rejects.toMatchObject({ status: 502 });
  });

  it("uses the global fetch by default", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ resourceId: "g" }));
    expect(await createJob(cfg, { name: "n", image: "i" })).toBe("g");
    spy.mockRestore();
  });
});

describe("api errors", () => {
  it("wraps a failed response with a truncated body", async () => {
    const f = fakeFetch(res({}, { status: 500, statusText: "Boom", text: "y".repeat(2000) }));
    const err = await getJob(cfg, "a/b", f).catch((e) => e);
    expect(err).toBeInstanceOf(NebiusApiError);
    expect(err.message).toBe("GET /ai/v1/jobs/a%2Fb failed: 500 Boom");
    expect(err.body).toHaveLength(1000);
    expect((f as any).mock.calls[0][1]).not.toHaveProperty("body");
  });
  it("tolerates an unreadable error body", async () => {
    const err = await getJob(cfg, "j", fakeFetch(res({}, { status: 502, text: new Error("x") }))).catch((e) => e);
    expect(err.body).toBe("");
  });
});

describe("getJob / getJobByName / listJobs / cancelJob", () => {
  const job = { metadata: { id: "j" }, status: { state: "RUNNING" } };
  it("getJob returns the job", async () => expect(await getJob(cfg, "j", fakeFetch(res(job)))).toEqual(job));
  it("getJobByName returns the job and encodes the query", async () => {
    const f = fakeFetch(res(job));
    expect(await getJobByName(cfg, "project p", "n&m", f)).toEqual(job);
    expect((f as any).mock.calls[0][0]).toContain("parentId=project%20p&name=n%26m");
  });
  it("getJobByName maps 404 to null and rethrows others", async () => {
    expect(await getJobByName(cfg, "p", "n", fakeFetch(res({}, { status: 404 })))).toBeNull();
    await expect(getJobByName(cfg, "p", "n", fakeFetch(res({}, { status: 500 })))).rejects.toMatchObject({ status: 500 });
    const f = vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch;
    await expect(getJobByName(cfg, "p", "n", f)).rejects.toThrow("net");
  });
  it("listJobs defaults to the config project and tolerates no items", async () => {
    const f = fakeFetch(res({ items: [job] }));
    expect(await listJobs(cfg, undefined, f)).toEqual([job]);
    expect((f as any).mock.calls[0][0]).toContain("parentId=project-home");
    expect(await listJobs(cfg, "project-z", fakeFetch(res({})))).toEqual([]);
  });
  it("cancelJob posts the id", async () => {
    const f = fakeFetch(res({}));
    await cancelJob(cfg, "j", f);
    expect(JSON.parse((f as any).mock.calls[0][1].body)).toEqual({ id: "j" });
  });
});

describe("call log", () => {
  it("records calls and keeps only the newest 200", async () => {
    const before = recentCalls().length;
    await getJob(cfg, "j", fakeFetch(res({})));
    expect(recentCalls().length).toBe(before + 1);
    expect(recentCalls().at(-1)).toMatchObject({ method: "GET", status: 200 });
    for (let i = 0; i < 250; i++) logCall({ method: "M", path: String(i), status: 200, durationMs: 0, at: "t" });
    expect(recentCalls()).toHaveLength(200);
    expect(recentCalls().at(-1)?.path).toBe("249");
  });
});
