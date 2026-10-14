import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudgeStrip, Masthead } from "@/components/Chrome";
import { EvidenceFile } from "@/components/EvidenceFile";
import { getStore, isCaseId } from "@/lib/store";
import { viewFromPack } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Awas — evidence file", robots: { index: false, follow: false } };

/** A shared evidence file. Reads the stored (sanitised) pack; never calls Token Factory or Tavily. */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCaseId(id)) notFound();
  const pack = await getStore().getPack(id);
  if (!pack) notFound();
  return (
    <main className="sheet">
      <Masthead sub={`evidence file · ${pack.createdAt.slice(0, 10)}`} />
      <EvidenceFile view={viewFromPack(pack)} />
      <JudgeStrip />
    </main>
  );
}
