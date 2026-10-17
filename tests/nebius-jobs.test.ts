import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelJob,
  createJob,
  getJob,
  getJobByName,
  INJECTED_FILE_MAX_BYTES,
  listJobs,
  logCall,
  NebiusApiError,
  recentCalls,
  type CreateJobOptions,
  type NebiusJob,
} from "@/lib/nebius/jobs";
import type { NebiusConfig } from "@/lib/nebius/config";

const CFG = {
  configured: true,
  config: {
    serviceAccountId: "sa-test",
    authKeyId: "key-test",
    privateKeyPem: "test",
    projectId: "project-test",
    subnetId: "subnet-test",
    region: "eu-west1",
    bucket: "bucket-test",
    s3Endpoint: "https://s3.test",
    s3AccessKeyId: "ak",
    s3SecretAccessKey: "sk",
  },
} as unknown as NebiusConfig;

const mockJob: NebiusJob = {
  metadata: {
    id: "job-test",
    parentId: "project-test",
    name: "test-job",
    createdAt: "2026-01-01T00:00:00Z",
  },
  status: {
    state: "COMPLETED",
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:01:00Z",
  },
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("logCall and recentCalls", () => {
  beforeEach(() => {
    while (recentCalls().length > 0) logCall({ method: "", path: "", status: 0, durationMs: 0, at: "" }); // clear
  });

  it("logs API calls and keeps the newest ones", () => {
    logCall({ method: "GET", path: "/api/1", status: 200, durationMs: 10, at: "2026-01-01T00:00:00Z" });
    expect(recentCalls()).toHaveLength(1);
    expect(recentCalls()[0].path).toBe("/api/1");
  });

  it("trims log to the last 200 entries", () => {
    for (let i = 0; i < 250; i++) {
      logCall({ method: "GET", path: `/api/${i}`, status: 200, durationMs: 1, at: "" });
    }
    expect(recentCalls()).toHaveLength(200);
    expect(recentCalls()[0].path).toContain("50"); // oldest should be ~50
  });
});

describe("createJob", () => {
  const mockFetch = (body: unknown) => vi.fn(async () => ok(body));

  it("creates a job with minimal options", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    const jobId = await createJob(CFG, { name: "test", image: "python:3.11" }, f);
    expect(jobId).toBe("job-123");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/ai/v1/jobs");
    expect(init.method).toBe("POST");
  });

  it("includes optional fields when provided", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    await createJob(
      CFG,
      {
        name: "test",
        image: "python:3.11",
        containerCommand: "/bin/sh",
        args: "-c test",
        env: { KEY: "value" },
        timeoutSeconds: 7200,
        diskSizeBytes: 100 * 1024 * 1024 * 1024,
        platform: "cpu-d4",
        preset: "4vcpu-16gb",
      },
      f,
    );
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.spec.containerCommand).toBe("/bin/sh");
    expect(body.spec.args).toBe("-c test");
    expect(body.spec.environmentVariables).toEqual([{ name: "KEY", value: "value" }]);
    expect(body.spec.timeout).toBe("7200s");
  });

  it("uses default timeout of 3600s minimum", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    await createJob(CFG, { name: "test", image: "python:3.11", timeoutSeconds: 1800 }, f);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.spec.timeout).toBe("3600s"); // minimum enforced
  });

  it("encodes injected files in base64", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    await createJob(
      CFG,
      {
        name: "test",
        image: "python:3.11",
        files: [{ containerPath: "/test.txt", content: "hello" }],
      },
      f,
    );
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.spec.injectedFiles).toHaveLength(1);
    expect(body.spec.injectedFiles[0].content).toBe(Buffer.from("hello", "utf8").toString("base64"));
  });

  it("rejects injected files that are empty", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    await expect(
      createJob(
        CFG,
        {
          name: "test",
          image: "python:3.11",
          files: [{ containerPath: "/empty.txt", content: "" }],
        },
        f,
      ),
    ).rejects.toThrow(NebiusApiError);
  });

  it("rejects injected files that exceed 64 KiB", async () => {
    const f = mockFetch({ resourceId: "job-123" });
    const large = "x".repeat(INJECTED_FILE_MAX_BYTES + 1);
    await expect(
      createJob(
        CFG,
        {
          name: "test",
          image: "python:3.11",
          files: [{ containerPath: "/large.txt", content: large }],
        },
        f,
      ),
    ).rejects.toThrow(NebiusApiError);
  });

  it("throws on operation with no resourceId", async () => {
    const f = mockFetch({});
    await expect(createJob(CFG, { name: "test", image: "python:3.11" }, f)).rejects.toThrow(NebiusApiError);
  });
});

describe("getJob", () => {
  it("fetches a job by ID", async () => {
    const f = vi.fn(async () => ok(mockJob));
    const job = await getJob(CFG, "job-123", f);
    expect(job.metadata.id).toBe("job-test");
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("/ai/v1/jobs/job-123");
  });

  it("URL-encodes the job ID", async () => {
    const f = vi.fn(async () => ok(mockJob));
    await getJob(CFG, "job/special?id", f);
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("job%2Fspecial%3Fid");
  });
});

describe("getJobByName", () => {
  it("fetches a job by name", async () => {
    const f = vi.fn(async () => ok(mockJob));
    const job = await getJobByName(CFG, "project-123", "test-job", f);
    expect(job?.metadata.id).toBe("job-test");
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("get-by-name");
    expect(url).toContain("parentId=project-123");
    expect(url).toContain("name=test-job");
  });

  it("returns null on 404", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 404, statusText: "Not Found" }));
    const job = await getJobByName(CFG, "project-123", "missing", f);
    expect(job).toBeNull();
  });

  it("throws on other errors", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 500, statusText: "Error" }));
    await expect(getJobByName(CFG, "project-123", "test", f)).rejects.toThrow(NebiusApiError);
  });
});

describe("listJobs", () => {
  it("lists jobs in a project", async () => {
    const f = vi.fn(async () => ok({ items: [mockJob] }));
    const jobs = await listJobs(CFG, "project-123", f);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].metadata.id).toBe("job-test");
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("parentId=project-123");
  });

  it("uses default project from config", async () => {
    const f = vi.fn(async () => ok({ items: [] }));
    await listJobs(CFG, undefined, f);
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("parentId=project-test");
  });

  it("returns empty array when items is missing", async () => {
    const f = vi.fn(async () => ok({}));
    const jobs = await listJobs(CFG, "project-123", f);
    expect(jobs).toEqual([]);
  });
});

describe("cancelJob", () => {
  it("cancels a job", async () => {
    const f = vi.fn(async () => ok({}));
    await cancelJob(CFG, "job-123", f);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/ai/v1/jobs/cancel");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.id).toBe("job-123");
  });
});

describe("NebiusApiError", () => {
  it("is an Error with status and body", () => {
    const err = new NebiusApiError("test error", 500, "body content");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("NebiusApiError");
    expect(err.message).toBe("test error");
    expect(err.status).toBe(500);
    expect(err.body).toBe("body content");
  });
});
