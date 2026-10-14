import type { Metadata } from "next";
import { Checker } from "@/components/Checker";
import { JudgeStrip, Masthead } from "@/components/Chrome";

export const metadata: Metadata = { title: "Awas — for judges", robots: { index: false } };

export default async function Judge({ searchParams }: { searchParams: Promise<{ judge?: string }> }) {
  const { judge } = await searchParams;
  return (
    <main className="sheet">
      <Masthead sub="judge view · English glosses open" />
      <div className="judge-strip">
        <p>
          <b>No login, no daily cap.</b> Open a recorded case below (no key needed), then paste your own ad text. With the judge code from the Devpost testing notes in the URL (<code>/judge?judge=…</code>), live checks skip the per-connection limit.
        </p>
        <p>
          Every highlighted quote links to its source page with a text fragment; the verdict is decided by code, never by the model.
        </p>
      </div>
      <Checker judgeCode={judge ?? null} judge />
      <JudgeStrip />
    </main>
  );
}
