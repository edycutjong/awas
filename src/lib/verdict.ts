/**
 * The verdict — a pure function of (flags, verified lines, failed steps). The model cannot set it.
 *
 * Truth table, first match wins (architecture.md):
 *   1. a NEVER-class flag whose official source is recorded                         → STOP
 *   2. a verified line that names the ad's company (entity) AND a negative-event term
 *      AND no guard term — "company-matched"                                         → STOP
 *   3. any CAUTION flag, an unsourced NEVER flag, an entity match without a negative
 *      term or with a guard term, a capped entity match, or any failed step          → VERIFY FIRST
 *   4. every step completed and nothing above fired                                  → NO RED FLAGS FOUND (not a guarantee)
 *
 * Lines from the pattern search (destination + job news) are context only, never an input: the destination-advisory
 * flag already covers advisory destinations, so NO RED FLAGS FOUND stays reachable for a licensed ad.
 * Term lists are tuned on the dev set only (bench/PROTOCOL.md).
 */

import type { EvidenceLine, Flag, Verdict } from "./types";

/** A published report of harm. Matched on word boundaries over the normalised quote. */
export const NEGATIVE_TERMS: { term: string; re: RegExp }[] = [
  { term: "penipuan", re: /\bpenipu(an)?\b/ },
  { term: "TPPO", re: /\btppo\b/ },
  { term: "perdagangan orang", re: /\bperdagangan orang\b/ },
  { term: "korban", re: /\bkorban\b/ },
  { term: "ilegal", re: /\bilegal\b/ },
  { term: "tidak terdaftar", re: /\btidak terdaftar\b/ },
  { term: "scam", re: /\bscam(mer|mers|ming)?\b/ },
  { term: "trafficking", re: /\btrafficking\b|\btrafficked\b/ },
];

/** The page says the name was misused by others, or denied. */
export const GUARD_TERMS: { term: string; re: RegExp }[] = [
  { term: "mengatasnamakan", re: /\bmengatasnamakan\b/ },
  { term: "mencatut", re: /\bmencatut\b/ },
  { term: "palsu", re: /\bpalsu\b/ },
  { term: "membantah", re: /\bmembantah\b/ },
  { term: "tidak terlibat", re: /\btidak terlibat\b/ },
];

export function negativeTerms(normalisedQuote: string): string[] {
  return NEGATIVE_TERMS.filter((t) => t.re.test(normalisedQuote)).map((t) => t.term);
}

export function guardTerms(normalisedQuote: string): string[] {
  return GUARD_TERMS.filter((t) => t.re.test(normalisedQuote)).map((t) => t.term);
}

/** A line the verdict may use: verified and found by the company, phone or advisory lookups (not the pattern search). */
export function isVerdictInput(line: EvidenceLine): boolean {
  return line.status === "verified" && line.purpose !== "pattern";
}

export function isCompanyMatched(line: EvidenceLine): boolean {
  return isVerdictInput(line) && line.entity && !line.entityCapped && line.entityKind === "company" && line.negative && !line.guard;
}

export interface Decision {
  verdict: Verdict;
  /** One line, listing every reason that fired. */
  rule: string;
  reasons: string[];
}

const FLAG_REASON: Record<string, string> = {
  tourist_visa: "tourist or visit visa offered for work",
  fee_before_contract: "a fee asked before a contract is signed",
  passport_retention: "the passport is held or handed over",
  fee_before_departure: "a fee asked before departure",
  high_pay_no_experience: "high pay with no experience needed",
  advisory_destination: "the destination is named in an official warning",
  personal_recruiter: "the recruiter is a personal number with no company named",
  visit_visa_holder: "the ad accepts visit-visa holders",
};

export function decide(flags: Flag[], lines: EvidenceLine[], failedSteps: string[]): Decision {
  const never = flags.filter((f) => f.class === "NEVER");
  const matched = lines.filter(isCompanyMatched);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (never.length > 0 || matched.length > 0) {
    const reasons = [
      ...never.map((f) => `rule: ${FLAG_REASON[f.id]}`),
      ...(matched.length > 0 ? [plural(new Set(matched.map((l) => l.url)).size, "published report naming this company", "published reports naming this company")] : []),
    ];
    return { verdict: "STOP", rule: `STOP — ${reasons.join(" + ")}`, reasons };
  }

  const caution = flags.filter((f) => f.class === "CAUTION");
  const entityOnly = lines.filter((l) => isVerdictInput(l) && l.entity && !isCompanyMatched(l));
  if (caution.length > 0 || entityOnly.length > 0 || failedSteps.length > 0) {
    const reasons = [
      ...caution.map((f) => (f.sourced || !["tourist_visa", "fee_before_contract", "passport_retention"].includes(f.id) ? FLAG_REASON[f.id] : `${FLAG_REASON[f.id]} (no official source recorded for this rule)`)),
      ...(entityOnly.some((l) => l.guard) ? ["a page says this name was used by others or denied"] : []),
      ...(entityOnly.some((l) => !l.guard && !l.entityCapped && !l.negative) ? ["a page names this company without reporting harm"] : []),
      ...(entityOnly.some((l) => !l.guard && l.entityCapped) ? [entityOnly.some((l) => l.entityKind === "phone") ? "a page mentions this phone number" : "a page mentions a similar or generic name — check the licence number"] : []),
      ...failedSteps.map((s) => `step not completed: ${s}`),
    ];
    return { verdict: "VERIFY_FIRST", rule: `VERIFY FIRST — ${reasons.join("; ")}`, reasons };
  }

  return { verdict: "NO_RED_FLAGS_FOUND", rule: "NO RED FLAGS FOUND — every step completed and no rule fired. This is not a guarantee.", reasons: [] };
}
