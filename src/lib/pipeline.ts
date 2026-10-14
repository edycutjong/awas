/**
 * One check, end to end: paste → extract (TF 1) → rubric → Tavily → propose (TF 2) → quote gate → verdict → message (TF 3).
 *
 * Streams events as each step completes and writes the (sanitised) partial pack after every step, so a run cut off by
 * a function time limit still renders what completed from GET /api/case/<id>. A failed step is named and can never
 * produce NO RED FLAGS FOUND. Bench mode differs from live use in exactly four documented ways: `exclude` (the case's
 * source domain and near-duplicate titles), a secret header that skips the per-IP slot, the `stage` ablation parameter,
 * and the optional `endDate` time cut.
 */

import { createHash } from "node:crypto";
import { addToCorpus, gateLine, type Corpus, type GateContext } from "./gate";
import { extractFields } from "./extract";
import { maskAll, newCaseId, sanitise } from "./mask";
import { domainOf, verifySteps, writeMessage } from "./message";
import { filterCorpus, pickSentences, proposeLines } from "./propose";
import { evaluateRubric } from "./rubric";
import { MAX_AD_CHARS, MIN_AD_CHARS } from "./settings";
import { exactQuery, extract, search, type SearchResponse, type TavilyOutcome } from "./tavily";
import { normalise } from "./text";
import { decide, isCompanyMatched, isVerdictInput } from "./verdict";
import type { TavilyConfig, TokenFactoryConfig } from "./nebius/config";
import type { EvidenceLine, EvidencePack, Extraction, Mode, Stage, TavilyReceipt, TfCallReceipt } from "./types";
import type { Store } from "./store";

export interface CheckInput {
  adText: string;
  lang: "id" | "en";
  mode: Mode;
  stage: Stage;
  /** Bench mode only: the benchmark row's own source, excluded from every Tavily result. */
  exclude?: { domain: string; title: string };
  /** Bench mode only: the company search's `end_date` (YYYY-MM-DD) — the "published before" column. */
  endDate?: string;
  caseId?: string;
}

export interface Deps {
  tf: TokenFactoryConfig | null;
  tavily: TavilyConfig | null;
  store: Store;
  fetchImpl?: typeof fetch;
  /** Wall-clock budget for the whole run (the function limit minus a margin). */
  budgetMs?: number;
}

export type Emit = (event: string, data: unknown) => void;

export type BadInput = "empty" | "too_short" | "too_long" | "not_a_job_ad";

const OFFICIAL = /(^|\.)(go\.id|iom\.int|ilo\.org|unodc\.org|un\.org)$/;

/** Bench `exclude`: the source domain, and titles sharing ≥ 60 % of normalised tokens with the source title. */
export function excluded(url: string, title: string | undefined, ex: CheckInput["exclude"]): boolean {
  if (!ex) return false;
  const d = domainOf(url);
  if (d === ex.domain || d.endsWith(`.${ex.domain}`)) return true;
  if (!title) return false;
  const a = new Set(normalise(title).match(/[\p{L}\p{N}]+/gu) ?? []);
  const b = new Set(normalise(ex.title).match(/[\p{L}\p{N}]+/gu) ?? []);
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size) >= 0.6;
}

function emptyPack(input: CheckInput, id: string): EvidencePack {
  return {
    id,
    createdAt: new Date().toISOString(),
    mode: input.mode,
    stage: input.stage,
    lang: input.lang,
    adSha256: createHash("sha256").update(input.adText, "utf8").digest("hex"),
    adTextMasked: input.adText,
    extraction: null,
    flags: [],
    tavily: [],
    lines: [],
    verdict: null,
    rule: "",
    verifySteps: [],
    messageId: "",
    messageEn: "",
    explanationEn: "",
    messageSource: null,
    receipt: { models: [], tfCalls: 0, tfTokens: 0, tavilyCredits: 0, ms: 0, failedSteps: [], tf: [] },
    done: false,
  };
}

export function validateAd(text: string): BadInput | null {
  const t = text.trim();
  if (!t) return "empty";
  if (t.length < MIN_AD_CHARS) return "too_short";
  if (t.length > MAX_AD_CHARS) return "too_long";
  return null;
}

/** The pattern query: the ad's own job and destination in Indonesian news, plus the tourist-visa words if the ad has them. */
export function patternQuery(ex: Extraction | null): string | null {
  if (!ex || (!ex.job && !ex.destination)) return null;
  const visa = ex.visa && /turis|kunjungan|wisata|tourist|visit/i.test(ex.visa.text) ? "visa turis" : "";
  return ["lowongan", ex.job?.text, ex.destination?.text, visa, "korban penipuan"].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 300);
}

export async function runCheck(input: CheckInput, deps: Deps, emit: Emit = () => {}): Promise<EvidencePack> {
  const started = Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const budget = deps.budgetMs ?? 280_000;
  const left = () => budget - (Date.now() - started);
  const pack = emptyPack(input, input.caseId ?? newCaseId());
  const failed = pack.receipt.failedSteps;
  const tfReceipts: TfCallReceipt[] = pack.receipt.tf;

  const save = async (final = false) => {
    pack.receipt.ms = Date.now() - started;
    pack.receipt.tfCalls = tfReceipts.length;
    pack.receipt.tfTokens = tfReceipts.reduce((s, r) => s + (r.promptTokens ?? 0) + (r.completionTokens ?? 0), 0);
    pack.receipt.models = [...new Set(tfReceipts.map((r) => r.model))];
    pack.receipt.tavilyCredits = pack.tavily.reduce((s, t) => s + (t.credits ?? 0), 0);
    pack.done = final;
    try {
      await deps.store.putPack(sanitise(pack));
    } catch (e) {
      if (final) emit("step_error", { step: "storage", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const bad = validateAd(input.adText);
  if (bad) {
    emit("bad_input", { reason: bad });
    pack.rule = `no check — ${bad.replace(/_/g, " ")}`;
    return pack;
  }
  emit("started", { caseId: pack.id, mode: input.mode, stage: input.stage });

  // 1 · Extraction (TF call 1) — skipped for the rubric-only ablation column.
  let ex: Extraction | null = null;
  if (input.stage !== "rubric") {
    if (!deps.tf) {
      failed.push("extraction (Token Factory not configured)");
      emit("step_error", { step: "extraction", message: "Token Factory is not configured" });
    } else {
      const out = await extractFields(deps.tf, input.adText, fetchImpl);
      tfReceipts.push(out.receipt);
      if (out.error || !out.extraction) {
        failed.push("extraction");
        emit("step_error", { step: "extraction", message: out.error });
      } else {
        ex = out.extraction;
      }
    }
    pack.extraction = ex;
    emit("extracted", { extraction: ex ? sanitise({ ...pack, extraction: ex }).extraction : null });
  }

  // 2 · Rubric (code).
  pack.flags = evaluateRubric(input.adText, ex);
  emit("flags", { flags: pack.flags });
  const ruleStop = pack.flags.filter((f) => f.class === "NEVER");
  if (ruleStop.length > 0) emit("rule_stop", { flags: ruleStop.map((f) => f.id) });
  await save();

  // `is_job_offer:false` never cancels a verdict: it only gates Tavily spending when no rule fired.
  if (input.stage !== "rubric" && ex && !ex.isJobOffer && pack.flags.length === 0) {
    emit("bad_input", { reason: "not_a_job_ad" });
    pack.rule = "no check — the text does not read as a job offer, and no rule fired";
    await save(true);
    return pack;
  }

  const corpus: Corpus = new Map();
  const ctx: GateContext = { company: ex?.company?.text, phones: (ex?.phones ?? []).map((p) => p.text) };

  if (input.stage === "full") {
    // 3 · Tavily.
    if (!deps.tavily) {
      failed.push("Tavily (not configured)");
      emit("step_error", { step: "tavily", message: "Tavily is not configured" });
    } else {
      const tv = deps.tavily;
      const record = (o: TavilyOutcome<unknown>) => {
        pack.tavily.push(o.receipt);
        emit("tavily_call", { call: sanitise({ ...pack, tavily: [o.receipt] }).tavily[0] });
        if (!o.ok) {
          failed.push(`Tavily ${o.receipt.method} (${o.receipt.purpose})`);
          emit("step_error", { step: `tavily_${o.receipt.purpose}`, message: o.receipt.error });
        }
      };
      const excludeDomains = input.exclude ? { exclude_domains: [input.exclude.domain] } : {};
      const addSearch = (o: TavilyOutcome<SearchResponse>, purpose: TavilyReceipt["purpose"]) => {
        for (const r of o.body?.results ?? []) {
          if (excluded(r.url, r.title, input.exclude)) continue;
          addToCorpus(corpus, r.url, purpose, { title: r.title, pageText: r.raw_content ?? null, rankedText: r.content ?? null });
        }
      };
      const searches: Promise<void>[] = [];
      if (ex?.company) {
        const params: Record<string, unknown> = {
          query: exactQuery(ex.company.text), exact_match: true, country: "indonesia", topic: "general",
          search_depth: "basic", max_results: 5, include_raw_content: "text", ...excludeDomains,
          ...(input.endDate ? { end_date: input.endDate } : {}),
        };
        searches.push(search(tv, "company", params, fetchImpl).then((o) => { record(o); addSearch(o, "company"); }));
      }
      if (input.mode !== "bench") {
        for (const phone of (ex?.phones ?? []).slice(0, 2)) {
          const params = { query: exactQuery(phone.text), exact_match: true, search_depth: "basic", max_results: 5, include_raw_content: "text" };
          searches.push(search(tv, "phone", params, fetchImpl).then((o) => { record(o); addSearch(o, "phone"); }));
        }
      }
      const pq = patternQuery(ex);
      if (pq) {
        const params = { query: pq, topic: "news", time_range: "year", language: "id", search_depth: "basic", max_results: 5, include_raw_content: "text", ...excludeDomains };
        searches.push(search(tv, "pattern", params, fetchImpl).then((o) => { record(o); addSearch(o, "pattern"); }));
      }
      await Promise.all(searches);
      const official = [...corpus.values()].map((d) => d.url).filter((u) => OFFICIAL.test(domainOf(u))).slice(0, 5);
      if (official.length > 0) {
        const o = await extract(tv, { urls: official, query: "peringatan tawaran kerja luar negeri visa turis penipuan", chunks_per_source: 3 }, fetchImpl);
        record(o);
        for (const r of o.body?.results ?? []) {
          if (!excluded(r.url, undefined, input.exclude)) addToCorpus(corpus, r.url, "advisory", { rankedText: r.raw_content ?? null });
        }
      }
    }
    await save();

    // 4 · Proposal (TF call 2) + quote gate, and the code sentence-picker column over the same filtered input.
    const sources = filterCorpus(corpus, ex);
    const lines: EvidenceLine[] = [];
    if (sources.length > 0 && deps.tf) {
      if (left() < 60_000) {
        failed.push("evidence proposal (time limit)");
        emit("step_error", { step: "propose", message: "not enough time left in this run" });
      } else {
        const out = await proposeLines(deps.tf, input.adText, ex, sources, fetchImpl);
        tfReceipts.push(out.receipt);
        if (out.error) {
          failed.push("evidence proposal");
          emit("step_error", { step: "propose", message: out.error });
        }
        for (const [i, p] of out.proposals.entries()) {
          emit("line_pending", { index: i, url: p.url, quote: maskAll(p.quote, ctx.company, ctx.phones, "id") });
          const line = gateLine(p, corpus, ctx);
          line.claim = maskAll(p.claim || p.claimEn, ctx.company, ctx.phones, "id");
          if (line.status === "dropped") line.quote = maskAll(line.quote, ctx.company, ctx.phones, "id");
          lines.push(line);
          emit(line.status === "verified" ? "line_verified" : "line_dropped", { index: i, line });
        }
      }
    } else if (sources.length > 0 && !deps.tf) {
      failed.push("evidence proposal (Token Factory not configured)");
    }
    pack.lines = lines;
    const picked = pickSentences(sources, ex).map((p) => gateLine(p, corpus, ctx)).filter((l) => l.status === "verified");
    pack.picker = {
      lines: picked.map((l) => ({ url: l.url, quote: l.quote })),
      companyMatched: picked.some(isCompanyMatched),
      // Same verdict function, same flags and failed steps, with the picker's lines in place of call 2's.
      verdict: decide(pack.flags, picked, failed.filter((f) => !f.startsWith("evidence proposal"))).verdict,
    };
    await save();
  }

  // 5 · Verdict (code).
  const decision = decide(pack.flags, pack.lines, failed);
  pack.verdict = decision.verdict;
  pack.rule = decision.rule;
  const steps = verifySteps(pack.flags);
  pack.verifySteps = input.lang === "en" ? steps.en : steps.id;
  emit("verdict", { verdict: decision.verdict, rule: decision.rule, reasons: decision.reasons, steps: pack.verifySteps });

  // 6 · Message (TF call 3) — full runs only; the ablation columns stop at the verdict.
  if (input.stage === "full") {
    const quoted = [...pack.lines.filter(isCompanyMatched), ...pack.lines.filter((l) => isVerdictInput(l) && !isCompanyMatched(l))].slice(0, 2);
    const msg = await writeMessage(left() > 30_000 ? deps.tf : null, {
      verdict: decision.verdict, rule: decision.rule, reasons: decision.reasons, flags: pack.flags, lines: quoted,
      company: ctx.company, phones: ctx.phones,
    }, fetchImpl);
    if (msg.receipt) tfReceipts.push(msg.receipt);
    for (const [n, g] of msg.glosses) {
      const line = quoted[n - 1];
      if (line) {
        line.gloss = g.ok ? g.gloss : undefined;
        line.glossStatus = g.ok ? "ok" : "unavailable";
      }
    }
    pack.messageId = msg.messageId;
    pack.messageEn = msg.messageEn;
    pack.explanationEn = msg.explanationEn;
    pack.messageSource = msg.source;
    emit("message", { messageId: msg.messageId, messageEn: msg.messageEn, explanationEn: msg.explanationEn, source: msg.source, glosses: Object.fromEntries(msg.glosses) });
  }

  await save(true);
  emit("receipt", { receipt: pack.receipt });
  emit("done", { caseId: pack.id });
  return pack;
}
