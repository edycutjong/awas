import Link from "next/link";

export const REPO = "https://github.com/edycutjong/awas";

export function Masthead({ sub }: { sub?: string }) {
  return (
    <header className="mast-row">
      <Link href="/" className="mast" aria-label="Awas — home">
        Awas
      </Link>
      <span className="mast-sub">{sub ?? "periksa iklan kerja sebelum berangkat · check a job ad before anyone boards"}</span>
    </header>
  );
}

export function JudgeStrip() {
  return (
    <footer className="foot">
      <p>
        Tanpa login, tanpa batas harian · no login, no daily cap.
      </p>
      <p>
        <a href={REPO}>source</a> · <a href={`${REPO}/blob/main/DEMO.md`}>DEMO.md</a> · <Link href="/integrations">/integrations</Link> · <Link href="/judge">/judge</Link> · <a href="/about">/about</a> · <a href="/pitch">/pitch</a>
      </p>
      <p>
        Every quote is re-checkable: <code>python3 scripts/verify_quotes.py &lt;case-url&gt;</code>
      </p>
      <p>Built with Nebius Token Factory (NVIDIA Nemotron), Tavily and Nebius Object Storage.</p>
    </footer>
  );
}
