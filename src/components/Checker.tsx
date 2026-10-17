"use client";

/**
 * The paste box, the live check (POST /api/check, streamed), and the recorded sample cases. A sample is a stored real
 * run, replayed step by step and always labelled "recorded run · <date>".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { EvidenceFile } from "./EvidenceFile";
import { maskAll } from "@/lib/mask";
import { MAX_AD_CHARS, MIN_AD_CHARS } from "@/lib/settings";
import type { EvidencePack } from "@/lib/types";
import { emptyView, readEvents, reduce, viewFromPack, type View } from "@/lib/view";

const BAD_INPUT: Record<string, string> = {
  empty: "Tempel teks iklannya dulu · paste the ad text first.",
  too_short: `Terlalu pendek untuk diperiksa (minimal ${MIN_AD_CHARS} karakter) · too short to check.`,
  too_long: `Terlalu panjang (maksimal ${MAX_AD_CHARS} karakter) · too long.`,
  not_a_job_ad: "Teks ini tidak terbaca sebagai lowongan kerja, dan tidak ada aturan yang terpicu · this does not read as a job offer, and no rule fired. Nothing was searched.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function Checker({ judgeCode = null, judge = false }: { judgeCode?: string | null; judge?: boolean }) {
  const [ad, setAd] = useState("");
  const [view, setView] = useState<View>(emptyView());
  const [samples, setSamples] = useState<EvidencePack[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const runId = useRef(0);
  const fileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => (r.ok ? r.json() : { samples: [] }))
      .then((d: { samples: EvidencePack[] }) => setSamples(d.samples ?? []))
      .catch(() => setSamples([]));
  }, []);

  const running = view.status === "running";

  const check = useCallback(async () => {
    const id = ++runId.current;
    setActive(null);
    let v: View = { ...emptyView(ad), status: "running" };
    setView(v);
    fileRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    try {
      const res = await fetch(`/api/check${judgeCode ? `?judge=${encodeURIComponent(judgeCode)}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adText: ad, lang: "id" }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await readEvents(res.body, (event, data) => {
        if (id !== runId.current) return;
        v = reduce(v, event, data);
        setView(v);
      });
      if (id === runId.current && v.status === "running") setView({ ...v, status: v.caseId ? "done" : "error" });
    } catch (e) {
      if (id === runId.current) setView({ ...v, status: "error", errors: [...v.errors, { step: "connection", message: e instanceof Error ? e.message : String(e) }] });
    }
  }, [ad, judgeCode]);

  /** Replay a recorded run: the same file, revealed in the order it was produced. */
  const replay = useCallback(async (pack: EvidencePack) => {
    const id = ++runId.current;
    setActive(pack.id);
    setAd("");
    const full = viewFromPack(pack);
    const fast = prefersReducedMotion();
    if (fast) {
      setView(full);
      return;
    }
    let v: View = { ...emptyView(full.adText), status: "running", recordedAt: full.recordedAt, sampleLabel: full.sampleLabel, mode: "sample", caseId: full.caseId };
    const step = async (patch: Partial<View>, ms: number) => {
      if (id !== runId.current) return false;
      v = { ...v, ...patch };
      setView(v);
      await sleep(ms);
      return id === runId.current;
    };
    fileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!(await step({ extraction: full.extraction }, 500))) return;
    if (!(await step({ flags: full.flags, ruleStop: full.ruleStop }, 600))) return;
    if (!(await step({ tavily: full.tavily }, 500))) return;
    // Pending quotes are name-masked, exactly as the live stream sends them; the real text appears once verified.
    const company = full.extraction?.company?.text;
    const phones = (full.extraction?.phones ?? []).map((p) => p.text);
    if (!(await step({ lines: full.lines.map((l) => ({ index: l.index, url: l.url, state: "pending" as const, quote: maskAll(l.quote, company, phones, "id") })) }, 700))) return;
    for (let i = 0; i < full.lines.length; i++) {
      const lines = v.lines.map((l, k) => (k === i ? full.lines[i] : l));
      if (!(await step({ lines }, 650))) return;
    }
    await step({ ...full }, 0);
  }, []);

  return (
    <>
      <section className="paste" aria-labelledby="paste-h">
        <h2 id="paste-h" className="sr-only">
          Periksa iklan · check an ad
        </h2>
        <label htmlFor="ad" className="label">
          Tempel iklan lowongan · paste the job ad
        </label>
        <textarea
          id="ad"
          className="clip"
          rows={8}
          maxLength={MAX_AD_CHARS}
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Contoh · example: Dibutuhkan CS online, gaji tinggi, visa diurus… (tempel teks iklan apa adanya · paste the ad's text as it is)"
          disabled={running}
        />
        <div className="paste-row">
          <span className="counter">
            {ad.length}/{MAX_AD_CHARS}
            {ad.trim().length === 0 ? " · tempel iklan dulu · paste an ad first" : ""}
          </span>
          <button type="button" className="btn" onClick={check} disabled={running || ad.trim().length === 0}>
            {running ? "Memeriksa… · Checking…" : "Periksa · Check"}
          </button>
        </div>
        <p className="hint">Iklannya gambar? Salin teksnya dengan fitur salin-teks di ponselmu · ad is an image? Copy its text with your phone&apos;s copy-text feature.</p>
        <p className="hint">Jangan tempel data pribadimu · do not paste your own personal data. Disimpan 75 hari, tidak diindeks mesin pencari, nomor telepon disamarkan · kept 75 days, not indexed by search engines, phone numbers masked.</p>
      </section>

      <section className="samples" aria-labelledby="samples-h">
        <h2 id="samples-h">Coba contoh · try a recorded case</h2>
        {samples === null ? (
          <p className="hint">memuat · loading…</p>
        ) : samples.length === 0 ? (
          <p className="hint">Belum ada rekaman · no recorded cases yet.</p>
        ) : (
          <div className="chips">
            {samples.map((s) => (
              <button key={s.id} type="button" className={`chip-btn ${active === s.id ? "on" : ""}`} onClick={() => replay(s)} aria-pressed={active === s.id}>
                <span className="chip-label">{s.sampleLabel ?? s.verdict?.replace(/_/g, " ")}</span>
                <span className="chip-meta">recorded run · {s.recordedAt?.slice(0, 10)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div ref={fileRef} className="file-anchor">
        {view.status === "rate_limited" ? (
          <p className="notice">
            Terlalu banyak pemeriksaan dari koneksi ini · too many checks from this connection — try a recorded case above, or wait an hour.
          </p>
        ) : view.status === "bad_input" && view.badInput ? (
          <p className="notice">{BAD_INPUT[view.badInput] ?? view.badInput}</p>
        ) : view.status !== "idle" ? (
          <EvidenceFile view={view} judge={judge} />
        ) : null}
        {view.status === "done" && view.caseId && view.mode !== "sample" ? (
          <p className="case-link">
            Tautan file ini · link to this file: <a href={`/case/${view.caseId}`}>/case/{view.caseId}</a>
          </p>
        ) : null}
      </div>
    </>
  );
}
