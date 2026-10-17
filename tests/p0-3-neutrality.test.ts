/**
 * P0-3 verdict-neutrality: re-score the recorded tranche-2 run offline (no Nebius job, no Token Factory, no Tavily).
 * The ad text comes from bench/tranche2.jsonl (its sha256 equals each recorded pack's adSha256); the frozen extraction, the verified/dropped lines and the failed steps come
 * from each row's recorded full_pack. The deterministic code (evaluateRubric -> decide) is run on them and compared with
 * the recorded verdict and rule; the span masking is then applied to the re-scored flags and must change only span.text.
 * `P03_WRITE_PROOF=1 npx vitest run tests/p0-3-neutrality.test.ts` rewrites docs/proof/p0-3-verdict-neutral-2026-10-18.json.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { maskFlags } from "@/lib/mask";
import { evaluateRubric } from "@/lib/rubric";
import { decide } from "@/lib/verdict";
import type { EvidencePack, Flag } from "@/lib/types";

const root = path.resolve(__dirname, "..");
const jsonl = (f: string) => readFileSync(path.join(root, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

interface Row {
  id: string;
  rubric: { verdict: string; rule: string };
  extract: { verdict: string; rule: string };
  full: { verdict: string; rule: string };
  full_pack: EvidencePack;
}

const rows: Row[] = jsonl("bench/results-t2.jsonl");
const ads = new Map<string, string>(jsonl("bench/tranche2.jsonl").map((r) => [r.id, r.ad_text_as_reported ?? r.ad_text]));
const key = (f: Flag) => `${f.id}|${f.class}|${f.via}|${f.sourced}|${f.span.start}-${f.span.end}`;

describe("P0-3 is verdict-neutral on the recorded tranche-2 run", () => {
  it("every verdict and rule of the rubric, extract and full columns is reproduced, and masking changes only span.text", () => {
    let compared = 0;
    let identical = 0;
    let flagSetsIdentical = 0;
    let flagsTotal = 0;
    let spansNewlyMasked = 0;
    const differences: string[] = [];
    const extractRuleTextOnly: string[] = [];
    const perRow: { id: string; verdict: string; flags: string[]; spansMasked: number }[] = [];
    for (const r of rows) {
      const ad = ads.get(r.id) as string;
      expect(ad, r.id).toBeTruthy();
      expect(createHash("sha256").update(ad).digest("hex"), r.id).toBe(r.full_pack.adSha256);
      const pack = r.full_pack;
      const failed = pack.receipt.failedSteps;
      const fRubric = evaluateRubric(ad, null);
      const fFull = evaluateRubric(ad, pack.extraction);
      const columns: [string, { verdict: string; rule: string }, ReturnType<typeof decide>][] = [
        ["rubric", r.rubric, decide(fRubric, [], [])],
        ["extract", r.extract, decide(fFull, [], [])],
        ["full", r.full, decide(fFull, pack.lines, failed)],
      ];
      for (const [name, rec, now] of columns) {
        compared++;
        if (now.verdict !== rec.verdict) differences.push(`${r.id}/${name}: VERDICT recorded ${rec.verdict} vs ${now.verdict}`);
        else if (now.rule === rec.rule) identical++;
        // The extract column ran its own extraction call and only the full column's is stored: a different (non-deterministic)
        // model extraction can reorder the reasons in the rule text. Verdicts still have to match; the case is listed.
        else if (name === "extract") {
          identical++;
          extractRuleTextOnly.push(`${r.id}: recorded "${rec.rule}" vs re-scored from the full column's extraction "${now.rule}"`);
        } else differences.push(`${r.id}/${name}: recorded ${rec.verdict} "${rec.rule}" vs ${now.verdict} "${now.rule}"`);
      }
      // The recorded flags (stored, sanitised) are the same flags the patched code would produce.
      flagsTotal += fFull.length;
      if (fFull.map(key).join(";") === pack.flags.map(key).join(";")) flagSetsIdentical++;
      else differences.push(`${r.id}: flag set differs from the recorded pack`);
      const masked = maskFlags(fFull);
      let n = 0;
      masked.forEach((m, i) => {
        expect({ ...m, span: { ...m.span, text: "" } }).toEqual({ ...fFull[i], span: { ...fFull[i].span, text: "" } });
        expect(m.span.text.length).toBe(fFull[i].span.text.length);
        if (m.span.text !== fFull[i].span.text) n++;
      });
      spansNewlyMasked += n;
      perRow.push({ id: r.id, verdict: columns[2][2].verdict, flags: fFull.map((f) => f.id), spansMasked: n });
    }
    expect(differences).toEqual([]);
    expect(identical).toBe(compared);
    expect(flagSetsIdentical).toBe(rows.length);

    if (process.env.P03_WRITE_PROOF === "1") {
      writeFileSync(
        path.join(root, "docs/proof/p0-3-verdict-neutral-2026-10-18.json"),
        JSON.stringify(
          {
            what: "P0-3 (raw phone digits in flags[].span) fixed post-freeze by masking flag excerpts with maskPhoneDigits after the verdict; offline re-score of the recorded tranche-2 run",
            method: "bench/tranche2.jsonl ad text + each row's recorded full_pack (frozen extraction, lines, failed steps) -> patched evaluateRubric/decide; compared with the recorded rubric, extract and full verdict + rule; maskFlags applied to the re-scored flags. No Nebius job, no Token Factory, no Tavily.",
            source: "bench/results-t2.jsonl",
            cases: rows.length,
            columns_compared: compared,
            verdicts_identical: identical,
            rule_text_identical: identical - extractRuleTextOnly.length,
            verdicts_differing: 0,
            rule_text_only_differences: extractRuleTextOnly,
            rule_text_note: "The extract column ran its own Token Factory extraction call; only the full column's extraction is stored in full_pack. Where the two extractions differ the reasons in the rule text can differ while the verdict is the same. The code under test (rubric.ts, verdict.ts) is unmodified by the P0-3 patch, so this is a property of the recording, not of the change.",
            flag_sets_identical_to_recorded: flagSetsIdentical,
            flags_total: flagsTotal,
            spans_newly_masked: spansNewlyMasked,
            note: spansNewlyMasked === 0 ? "No tranche-2 flag excerpt carried phone digits, so no span changed; the unit tests cover the masking itself." : undefined,
            per_case: perRow,
          },
          null,
          1,
        ) + "\n",
      );
    }
  });
});
