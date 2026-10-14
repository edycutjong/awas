import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The recorded sample cases: replays of real runs, each labelled with when it was recorded. No key needed. */
export async function GET() {
  const samples = (await getStore().listSamples()).filter((p) => p.recordedAt);
  return Response.json({ count: samples.length, samples }, { headers: { "Cache-Control": "public, max-age=60" } });
}
