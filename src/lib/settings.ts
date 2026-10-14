/**
 * Per-call Token Factory settings. The response format and reasoning knob are the ones the day-0 spike measured as
 * working (docs/proof/spike-*.json); budgets leave Super room to reason and still answer.
 */

import type { ReasoningKnob, ResponseFormatVariant } from "./tf";

export interface CallSetting {
  format: ResponseFormatVariant;
  reasoning: ReasoningKnob;
  maxTokens: number;
  timeoutMs: number;
}

export const CALL_SETTINGS: Record<"extract" | "propose" | "message", CallSetting> = {
  extract: { format: "json_object", reasoning: "low_effort", maxTokens: 4096, timeoutMs: 60_000 },
  propose: { format: "json_object", reasoning: "low_effort", maxTokens: 6144, timeoutMs: 75_000 },
  message: { format: "json_object", reasoning: "low_effort", maxTokens: 4096, timeoutMs: 60_000 },
};

/** Input limits (architecture: credit-draining bot defence). */
export const MAX_AD_CHARS = 6000;
export const MIN_AD_CHARS = 40;
