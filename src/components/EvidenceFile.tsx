"use client";

/**
 * The evidence file — one column, top to bottom, like a bound kliping (specs/ui.md). The highlighter is the only
 * saturated fill and appears ONLY behind a quote the gate verified; the stamp lands only after every card resolved.
 */

import { useMemo, useState } from "react";
import { FLAG_LABELS } from "@/lib/rubric";
import type { Flag, Span, TavilyReceipt } from "@/lib/types";
import type { View, ViewLine } from "@/lib/view";

const STAMP_WORD = { STOP: "STOP", VERIFY_FIRST: "VERIFY FIRST", NO_RED_FLAGS_FOUND: "NO RED FLAGS FOUND" } as const;
const STAMP_SUB = {
  STOP: "jangan berangkat dulu",
  VERIFY_FIRST: "periksa dulu",
  NO_RED_FLAGS_FOUND: "bukan jaminan · not a guarantee",
} as const;

const FIELD_LABEL: Record<string, string> = {
  company: "perusahaan",
  recruiter: "perekrut",
  phones: "nomor",
  destination: "negara",
  job: "pekerjaan",
  visa: "visa",
  fees: "biaya",
  promises: "janji",
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function firstWords(s: string, n: number): string {
  return s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

/** The ad with pencil underlines under every span the extraction located, labelled in the margin style. */
function AdClipping({ text, extraction }: { text: string; extraction: View["extraction"] }) {
  const spans = useMemo(() => {
    if (!extraction) return [] as (Span & { k: string })[];
    const all: (Span & { k: string })[] = [];
    const add = (k: string, s?: Span) => s && all.push({ ...s, k });
    add("company", extraction.company);
    add("recruiter", extraction.recruiter);
    extraction.phones.forEach((s) => add("phones", s));
    add("destination", extraction.destination);
    add("job", extraction.job);
    add("visa", extraction.visa);
    extraction.fees.forEach((s) => add("fees", s));
    extraction.promises.forEach((s) => add("promises", s));
    all.sort((a, b) => a.start - b.start || b.end - a.end);
    const out: (Span & { k: string })[] = [];
    for (const s of all) if (!out.some((o) => s.start < o.end && o.start < s.end)) out.push(s);
    return out;
  }, [extraction]);

  const parts: React.ReactNode[] = [];
  let at = 0;
  spans.forEach((s, i) => {
    if (s.start > at) parts.push(text.slice(at, s.start));
    parts.push(
      <span key={i} className="u" data-k={FIELD_LABEL[s.k] ?? s.k}>
        {text.slice(s.start, s.end)}
      </span>,
    );
    at = s.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <div className="clip ad">{parts}</div>;
}

function FlagRow({ flag }: { flag: Flag }) {
  const never = flag.class === "NEVER";
  const label = FLAG_LABELS[flag.id];
  return (
    <div className="flag">
      <span className={`tick ${never ? "" : "v"}`} aria-hidden="true" />
      <div>
        <b>{label.id}</b> <span className="en">· {label.en}</span>
        <div className="flag-span">
          <q>{flag.span.text}</q> <span className="via">{flag.via === "both" ? "model + rule" : flag.via === "model" ? "model" : "rule"}</span>
        </div>
        <div className="rule-src">
          {flag.source ? (
            <>
              aturan · rule: <a href={flag.source.url} target="_blank" rel="noopener noreferrer">{flag.source.domain}</a> · {flag.source.date}
            </>
          ) : (
            <>no official source recorded for this rule — counted as VERIFY FIRST, not STOP</>
          )}
        </div>
      </div>
    </div>
  );
}

function chipFor(line: ViewLine, calls: TavilyReceipt[]): TavilyReceipt | undefined {
  return calls.find((c) => c.purpose === line.purpose && c.urls.includes(line.url)) ?? calls.find((c) => c.urls.includes(line.url));
}

function TavilyChip({ call }: { call: TavilyReceipt }) {
  const p = call.params;
  const bits: string[] = [`tavily.${call.method}`];
  if (call.method === "search") {
    if (p.exact_match) bits.push("exact_match");
    if (p.topic && p.topic !== "general") bits.push(`topic:${String(p.topic)}`);
    if (p.time_range) bits.push(`time_range:${String(p.time_range)}`);
    if (p.country) bits.push(`country:${String(p.country)}`);
    if (typeof p.query === "string") bits.push(p.query.length > 48 ? `${p.query.slice(0, 46)}…` : p.query);
  } else {
    if (typeof p.query === "string") bits.push(`query:"${p.query.slice(0, 28)}…"`);
    bits.push(`chunks_per_source:${String(p.chunks_per_source ?? 3)}`);
  }
  const credits = call.credits === null ? "credits n/a" : `${call.credits} credit${call.credits === 1 ? "" : "s"}`;
  bits.push(call.method === "extract" ? `${credits} · billed per 5 URLs` : credits);
  return <span className="chip">{bits.join(" · ")}</span>;
}

function EvidenceCard({ line, calls, showGloss }: { line: ViewLine; calls: TavilyReceipt[]; showGloss: boolean }) {
  const call = chipFor(line, calls);
  if (line.state === "dropped") {
    const why =
      line.reason === "url_not_returned"
        ? "sumber ini tidak dikembalikan pencarian · the source was not one this search returned"
        : line.reason === "too_short"
          ? "kutipan terlalu pendek untuk diperiksa · quote too short to check"
          : "kutipan tidak ditemukan di halaman — tidak ditampilkan · quote not found in the page — not shown as evidence";
    return (
      <div className="clip card dropped" data-state="dropped">
        <div className="quote">{line.quote}</div>
        <div className="why">{why}</div>
      </div>
    );
  }
  const pending = line.state === "pending";
  const context = line.purpose === "pattern";
  return (
    <div className={`clip card ${pending ? "pending" : "verified"}`} data-state={line.state}>
      <div className="src">
        <span>{domainOf(line.url)}</span>
        <span>{context ? "konteks · context, not used for the verdict" : pending ? "memeriksa halaman… · checking the page…" : "kutipan ditemukan di halaman · quote found on the page"}</span>
      </div>
      <div className="quote">
        <span className={`hl ${pending ? "" : "on"}`}>“{line.quote}”</span>
      </div>
      {!pending && line.claim ? (
        <div className="claim">
          <span className="tag">bacaan Awas — belum diverifikasi · Awas&apos;s reading — not verified</span> {line.claim}
        </div>
      ) : null}
      {!pending && line.glossStatus ? (
        <details className="gloss" open={showGloss}>
          <summary>English</summary>
          {line.glossStatus === "ok" ? (
            <p>
              <span className="tag">translation — not evidence</span> {line.gloss}
            </p>
          ) : (
            <p className="tag">translation unavailable (it did not keep the source&apos;s hedges)</p>
          )}
        </details>
      ) : null}
      {!pending ? (
        <>
          <a className="url" href={line.fragmentUrl ?? line.url} target="_blank" rel="noopener noreferrer">
            {line.url}
          </a>
          <div className="find">
            {line.fragmentFoundAt
              ? `found on the live page ${line.fragmentFoundAt}`
              : `buka halaman dan cari · open the page and search for: “${firstWords(line.quote, 6)}”`}
          </div>
        </>
      ) : null}
      {call ? <TavilyChip call={call} /> : null}
    </div>
  );
}

function VerdictStamp({ verdict }: { verdict: NonNullable<View["verdict"]> }) {
  const cls = verdict === "STOP" ? "stop" : verdict === "VERIFY_FIRST" ? "check" : "none";
  return (
    <div className={`stamp ${cls}`} role="img" aria-label={`Verdict: ${STAMP_WORD[verdict]}`}>
      <div className="w">{STAMP_WORD[verdict]}</div>
      <div className="s">{STAMP_SUB[verdict]}</div>
    </div>
  );
}

function FamilyMessage({ view, caseUrl, enabled }: { view: View; caseUrl: string | null; enabled: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!view.messageId) return null;
  const share = `${view.messageId}${caseUrl ? `\n\n${caseUrl}` : ""}`;
  return (
    <section aria-labelledby="msg-h">
      <h2 id="msg-h">Pesan untuk keluarga · message to forward</h2>
      <div className="wa">
        <div className="from">untuk diteruskan · to forward{view.messageSource === "template" ? " · ditulis oleh kode · written by code" : ""}</div>
        <div className="msg">{view.messageId}</div>
      </div>
      <div className="btns">
        <button
          type="button"
          className="btn"
          disabled={!enabled}
          onClick={async () => {
            await navigator.clipboard.writeText(share);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Tersalin · Copied" : "Salin · Copy"}
        </button>
        <a
          className={`btn alt ${enabled ? "" : "disabled"}`}
          aria-disabled={!enabled}
          href={enabled ? `https://wa.me/?text=${encodeURIComponent(share)}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          Bagikan · Share
        </a>
      </div>
      <details className="en-msg">
        <summary>English translation</summary>
        <div className="msg">{view.messageEn}</div>
      </details>
    </section>
  );
}

function RunReceipt({ view }: { view: View }) {
  const r = view.receipt;
  const dropped = view.lines.filter((l) => l.state === "dropped").length;
  return (
    <details className="receipt" open={false}>
      <summary>Bagaimana ini diperiksa · How this was checked</summary>
      {view.explanationEn ? <p className="explain">{view.explanationEn}</p> : null}
      <ul>
        {(r?.tf ?? []).map((t, i) => (
          <li key={`tf${i}`}>
            Nebius Token Factory · {t.model} · {t.call} · {(t.promptTokens ?? 0) + (t.completionTokens ?? 0)} tokens · {(t.ms / 1000).toFixed(1)} s
            {t.error ? ` · failed: ${t.error}` : ""}
          </li>
        ))}
        {view.tavily.map((t, i) => (
          <li key={`tv${i}`}>
            Tavily {t.method} ({t.purpose}) · {t.credits ?? "n/a"} credit{t.credits === 1 ? "" : "s"} · {(t.ms / 1000).toFixed(1)} s · {t.urls.length} URLs{t.access === "keyless" ? " · keyless access" : ""}
            {t.error ? ` · failed: ${t.error}` : ""}
          </li>
        ))}
        <li>baris dibuang oleh gerbang kutipan · lines dropped by the quote gate: {dropped}</li>
        {r ? <li>total · {(r.ms / 1000).toFixed(1)} s · {r.tfTokens} TF tokens · {r.tavilyCredits} Tavily credits</li> : null}
        <li>disimpan di Nebius Object Storage · stored in Nebius Object Storage (cases/, 75 days)</li>
      </ul>
    </details>
  );
}

export function EvidenceFile({ view, judge = false }: { view: View; judge?: boolean }) {
  const pending = view.lines.some((l) => l.state === "pending");
  const finished = view.status === "done" && !!view.verdict && !pending;
  const caseUrl = view.caseId && typeof window !== "undefined" ? `${window.location.origin}/case/${view.caseId}` : null;
  const ruleBanner = view.ruleStop.length > 0 && !finished;
  const verifiedCount = view.lines.filter((l) => l.state === "verified").length;

  return (
    <article className="file" aria-live="polite">
      {view.recordedAt ? (
        <div className="recorded">
          rekaman · recorded run · {view.recordedAt.slice(0, 10)}
          {view.sampleLabel ? ` · ${view.sampleLabel}` : ""}
        </div>
      ) : null}
      <div className="stampwrap">
        {finished && view.verdict ? <VerdictStamp verdict={view.verdict} /> : null}
      </div>
      {ruleBanner ? (
        <p className="rule-banner">
          STOP — {view.ruleStop.map((id) => FLAG_LABELS[id].en.toLowerCase()).join("; ")} (rule; final)
        </p>
      ) : !finished && view.status === "running" ? (
        <p className="pending-banner">memeriksa — belum ada keputusan · checking — no verdict yet</p>
      ) : null}

      <div className="label">Iklan yang ditempel · the ad</div>
      <AdClipping text={view.adText} extraction={view.extraction} />

      {view.flags.length > 0 ? (
        <section aria-labelledby="flags-h">
          <h2 id="flags-h">Tanda bahaya · red flags</h2>
          {view.flags.map((f) => (
            <FlagRow key={f.id} flag={f} />
          ))}
        </section>
      ) : null}

      {view.registry?.found && /^aktif$/i.test(view.registry.found.status) ? (
        <p className="registry">
          <b>{view.registry.found.name}</b> terdaftar sebagai P3MI resmi per {view.registry.asOf} · listed as a licensed agency on the{" "}
          <a href={view.registry.source} target="_blank" rel="noopener noreferrer">
            official P3MI list
          </a>{" "}
          as of {view.registry.asOf}. Penipu sering memakai nama resmi — hubungi perusahaan lewat kontak di daftar itu, bukan nomor di iklan ·
          scammers reuse licensed names: contact the agency through the list, not the number in the ad.
        </p>
      ) : null}

      {view.lines.length > 0 || view.tavily.length > 0 ? (
        <section aria-labelledby="ev-h">
          <h2 id="ev-h">Konteks dari halaman yang sudah terbit · context from published pages</h2>
          {view.lines.length === 0 && view.status === "done" ? <p className="none">No evidence line was proposed from the pages this search returned.</p> : null}
          {view.lines.map((l) => (
            <EvidenceCard key={l.index} line={l} calls={view.tavily} showGloss={judge} />
          ))}
          {view.lines.length > 0 ? (
            <p className="gate-note">
              {verifiedCount} kutipan ditemukan di halaman · {view.lines.length - verifiedCount} dibuang. Every quote shown was found verbatim, by code, in the page text Tavily returned in this run.
            </p>
          ) : null}
        </section>
      ) : null}

      {view.errors.length > 0 ? (
        <section className="errors" aria-label="steps that did not complete">
          {view.errors.map((e, i) => (
            <p key={i}>
              Langkah tidak selesai · step not completed: {e.step}
              {e.message ? ` — ${e.message}` : ""}. Showing what completed.
            </p>
          ))}
        </section>
      ) : null}

      {finished && view.verdict ? (
        <section className={`verdict ${view.verdict === "STOP" ? "stop" : view.verdict === "VERIFY_FIRST" ? "check" : "none"}`} aria-labelledby="verdict-h">
          <h2 id="verdict-h">{STAMP_WORD[view.verdict]}</h2>
          <p className="rule-line">{view.rule}</p>
          {view.steps.length > 0 ? (
            <ol className="steps">
              {view.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      <FamilyMessage view={view} caseUrl={caseUrl} enabled={finished} />
      {view.receipt || view.tavily.length > 0 ? <RunReceipt view={view} /> : null}
      <p className="retention">
        Disimpan 75 hari, tidak diindeks mesin pencari, nomor telepon disamarkan · kept 75 days, not indexed by search engines, phone numbers masked.
      </p>
    </article>
  );
}
