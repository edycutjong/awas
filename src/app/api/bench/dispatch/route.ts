import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig, parseJobTarget } from "@/lib/nebius/config";
import { createJob, getJob } from "@/lib/nebius/jobs";
import { getJson, presignGet, presignPut, putJson } from "@/lib/nebius/storage";
import { isBench } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Builder-only (bench secret). SHOULD #1: run the frozen benchmark as a Nebius Serverless Job.
 *
 * POST {set, variance?, n?} creates a job in the bench region (BENCH_JOB_TARGET, not faultline's eu-west1 slots) that
 * runs the committed scripts/bench.py over the committed bench/<set>.jsonl against this deployment, in bench mode. The
 * job holds no credential: its results leave through presigned PUT URLs for exactly two keys. Before dispatch the set
 * file is checked against bench/MANIFEST.json, so the job can only run a frozen tranche as frozen.
 * GET ?runId=… returns the job's state and presigned GET URLs for its rows.
 */

const SETS = ["dev", "tranche1", "tranche2"] as const;
type BenchSet = (typeof SETS)[number];

interface Meta {
  runId: string;
  jobId: string;
  set: BenchSet;
  setSha256: string;
  benchPySha256: string;
  base: string;
  region: string;
  createdAt: string;
  variance: number;
  n: number;
  deployment: string | null;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const metaKey = (runId: string) => `bench/${runId}.meta.json`;

export async function POST(req: Request) {
  if (!isBench(req.headers.get("x-awas-bench"))) return Response.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadConfig();
  const target = parseJobTarget(process.env.BENCH_JOB_TARGET);
  if (!cfg.configured || !target) {
    return Response.json({ error: "Nebius service account or BENCH_JOB_TARGET not configured", missing: cfg.configured ? ["BENCH_JOB_TARGET"] : cfg.missing }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { set?: string; variance?: number; n?: number };
  const set = SETS.find((s) => s === body.set);
  if (!set) return Response.json({ error: `set must be one of ${SETS.join(", ")}` }, { status: 400 });
  const variance = Math.max(0, Math.min(10, Math.floor(Number(body.variance) || 0)));
  const n = Math.max(0, Math.floor(Number(body.n) || 0));

  const root = process.cwd();
  const [benchPy, rows, manifestRaw] = await Promise.all([
    readFile(path.join(root, "scripts/bench.py"), "utf8"),
    readFile(path.join(root, `bench/${set}.jsonl`), "utf8"),
    readFile(path.join(root, "bench/MANIFEST.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw) as { sets: Record<string, { file_sha256?: string }> };
  const setSha256 = sha256(rows);
  if (manifest.sets[set]?.file_sha256 !== setSha256) {
    return Response.json({ error: `bench/${set}.jsonl differs from MANIFEST.json — refusing to run an unfrozen set` }, { status: 409 });
  }

  const base = (process.env.BENCH_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const runId = `${set}-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}z`.toLowerCase();
  const day = 24 * 3600;
  const args = ["/opt/awas/bench.py", "--set", "/opt/awas/set.jsonl", "--base", base, "--out", "/tmp/results.jsonl"];
  if (n) args.push("--n", String(n));
  if (variance) args.push("--variance", String(variance));

  const jobId = await createJob(cfg.config, {
    name: `awas-bench-${runId}`.toLowerCase(),
    image: "python:3.11",
    target,
    containerCommand: "python3",
    args: args.join(" "),
    env: {
      AWAS_BENCH_SECRET: process.env.AWAS_BENCH_SECRET ?? "",
      AWAS_PUT_URL: presignPut(cfg.config, `bench/${runId}.jsonl`, day),
      AWAS_PUT_VARIANCE_URL: presignPut(cfg.config, `bench/${runId}-variance.jsonl`, day),
      PYTHONUNBUFFERED: "1",
    },
    files: [
      { containerPath: "/opt/awas/bench.py", content: benchPy },
      { containerPath: "/opt/awas/set.jsonl", content: rows },
    ],
    timeoutSeconds: 3600,
  });

  const meta: Meta = {
    runId, jobId, set, setSha256, benchPySha256: sha256(benchPy), base, region: target.region, createdAt: new Date().toISOString(),
    variance, n, deployment: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL ?? null,
  };
  await putJson(cfg.config, metaKey(runId), meta);
  return Response.json(meta);
}

export async function GET(req: Request) {
  if (!isBench(req.headers.get("x-awas-bench"))) return Response.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadConfig();
  if (!cfg.configured) return Response.json({ error: "not configured" }, { status: 503 });
  const runId = new URL(req.url).searchParams.get("runId") ?? "";
  if (!/^[a-z0-9-]{1,40}z$/i.test(runId)) return Response.json({ error: "need ?runId=" }, { status: 400 });
  const meta = await getJson<Meta>(cfg.config, metaKey(runId));
  if (!meta) return Response.json({ error: "no such run" }, { status: 404 });
  const job = await getJob(cfg.config, meta.jobId).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
  return Response.json({
    meta,
    job,
    results: presignGet(cfg.config, `bench/${runId}.jsonl`, 3600),
    variance: presignGet(cfg.config, `bench/${runId}-variance.jsonl`, 3600),
  });
}
