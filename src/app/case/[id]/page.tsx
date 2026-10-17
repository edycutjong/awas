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
  const store = getStore();
  // A recorded sample opens as itself — labelled, with its recording date — and outlives the 75-day case expiry.
  const [pack, samples] = await Promise.all([store.getPack(id), store.listSamples().catch(() => [])]);
  const sample = samples.find((s) => s.id === id && s.recordedAt) ?? null;
  const shown = sample ?? pack;
  if (!shown) notFound();
  return (
    <main className="sheet">
      <Masthead sub={`evidence file · ${shown.createdAt.slice(0, 10)}`} />
      {sample ? (
        <p className="back">
          <a href="/judge">← Coba kasus lain · try another recorded case</a>
        </p>
      ) : null}
      <EvidenceFile view={viewFromPack(shown)} />
      <JudgeStrip />
    </main>
  );
}
