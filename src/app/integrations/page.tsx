import type { Metadata } from "next";
import { JudgeStrip, Masthead } from "@/components/Chrome";
import { loadStorageConfig, loadTavilyConfig, loadTokenFactoryConfig } from "@/lib/nebius/config";
import { CREDIT_ALARM, getStore, monthKey } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Awas — sponsor integrations", robots: { index: false } };

/** Real calls from real live runs, anonymised: no ad text, no query strings, no case ids. */
export default async function Integrations() {
  const store = getStore();
  const month = monthKey();
  const [receipts, credits] = await Promise.all([store.recentReceipts(20).catch(() => []), store.getCredits(month).catch(() => 0)]);
  const tf = loadTokenFactoryConfig();
  const tavily = loadTavilyConfig();
  const storage = loadStorageConfig();
  return (
    <main className="sheet">
      <Masthead sub="sponsor integrations · the last 20 live runs" />
      <section className="clip">
        <h2>Configured</h2>
        <ul className="receipt-list">
          <li>Nebius Token Factory: {tf ? `${tf.models.extract} (call 1) · ${tf.models.propose} (call 2) · ${tf.models.message} (call 3)` : "not configured"}</li>
          <li>Tavily: {tavily ? `${tavily.access === "key" ? "API key" : "keyless access"} · /search + /extract` : "not configured"}</li>
          <li>Nebius Object Storage: {storage.configured ? `${storage.config.bucket} (${storage.config.region}) · cases/ expire after 75 days` : `local store (${store.kind})`}</li>
          <li>
            Tavily credits this month ({month}): {credits} · spend alarm at {CREDIT_ALARM}
            {credits >= CREDIT_ALARM ? " — TRIPPED" : ""}
          </li>
        </ul>
      </section>
      <section>
        <h2>Recent live runs</h2>
        {receipts.length === 0 ? <p className="hint">No live runs recorded yet.</p> : null}
        <div className="table-wrap">
          <table className="runs">
            <thead>
              <tr>
                <th>when (UTC)</th>
                <th>Nemotron on Token Factory</th>
                <th>TF tokens</th>
                <th>Tavily calls</th>
                <th>credits</th>
                <th>seconds</th>
                <th>verdict</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r, i) => (
                <tr key={i}>
                  <td>{r.at.slice(0, 16).replace("T", " ")}</td>
                  <td>{r.models.join(", ")}</td>
                  <td>{r.tfTokens}</td>
                  <td>{r.tavily.map((t) => `${t.method}:${t.purpose}`).join(" · ")}</td>
                  <td>{r.tavily.reduce((s, t) => s + (t.credits ?? 0), 0)}</td>
                  <td>{(r.ms / 1000).toFixed(1)}</td>
                  <td>{r.verdict?.replace(/_/g, " ") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <JudgeStrip />
    </main>
  );
}
