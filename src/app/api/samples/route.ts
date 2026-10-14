import { getStore, isBench, isCaseId, SAMPLE_SLUG } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The recorded sample cases: replays of real runs, each labelled with when it was recorded. No key needed. */
export async function GET() {
  const samples = (await getStore().listSamples()).filter((p) => p.recordedAt);
  return Response.json({ count: samples.length, samples }, { headers: { "Cache-Control": "public, max-age=60" } });
}

/**
 * Builder-only (bench secret): store a finished live run as a sample. The pack is copied as it was produced —
 * `recordedAt` is the run's own timestamp — so a sample is always a real run, never a hand-written one.
 */
export async function POST(req: Request) {
  if (!isBench(req.headers.get("x-awas-bench"))) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { caseId?: string; slug?: string; label?: string };
  if (!body.caseId || !isCaseId(body.caseId) || !body.slug || !SAMPLE_SLUG.test(body.slug) || !body.label) {
    return Response.json({ error: "need {caseId, slug, label}" }, { status: 400 });
  }
  const store = getStore();
  const pack = await store.getPack(body.caseId);
  if (!pack || !pack.done || pack.mode !== "live") return Response.json({ error: "not a finished live run" }, { status: 404 });
  await store.putSample(body.slug, { ...pack, recordedAt: pack.createdAt, sampleLabel: body.label.slice(0, 80) });
  return Response.json({ stored: `samples/${body.slug}.json`, recordedAt: pack.createdAt });
}
