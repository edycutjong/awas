/**
 * Official sources for the rubric's rules — every NEVER rule must have one here or it is drawn as CAUTION.
 * Each entry is a page fetched and quoted verbatim when it was recorded (date = fetch date); docs/SOURCES.md
 * lists the same pages for judges.
 */

import type { FlagId, RuleSource } from "./types";

export interface AdvisoryPlace {
  /** Display name. */
  name: string;
  /** RegExp source (case-insensitive, word-bounded by the caller). */
  pattern: string;
}

export interface RuleSources {
  flags: Partial<Record<FlagId, RuleSource>>;
  pay: { thresholdIdr: number; usdToIdr: number; source: RuleSource | null; rateSource: RuleSource | null };
  advisory: { places: AdvisoryPlace[]; source: RuleSource | null };
}

export const RULE_SOURCES: RuleSources = {
  flags: {},
  pay: { thresholdIdr: Number.POSITIVE_INFINITY, usdToIdr: 0, source: null, rateSource: null },
  advisory: { places: [], source: null },
};
