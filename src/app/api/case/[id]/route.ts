import { getStore, isCaseId } from "@/lib/store";

export const dynamic = "force-dynamic";

/** A stored evidence pack (already sanitised before it was written). Never calls Token Factory or Tavily. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
  if (!isCaseId(id)) return Response.json({ error: "not a case id" }, { status: 404, headers });
  const pack = await getStore().getPack(id);
  if (!pack) return Response.json({ error: "no such case (cases are kept 75 days)" }, { status: 404, headers });
  return Response.json(pack, { headers });
}
