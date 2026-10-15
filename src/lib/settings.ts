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

// Day-0 spike (docs/proof/spike-2026-10-15.json, spike-ultra-2026-10-15.json): the API-reference form
// {name, schema, strict} is honoured by Super, Lightning and Ultra; the guide's raw-schema form is refused with 422.
// The message call has no schema, so it goes out as json_object.
export const CALL_SETTINGS: Record<"extract" | "propose" | "message", CallSetting> = {
  extract: { format: "json_schema_named", reasoning: "low_effort", maxTokens: 4096, timeoutMs: 60_000 },
  propose: { format: "json_schema_named", reasoning: "low_effort", maxTokens: 6144, timeoutMs: 75_000 },
  message: { format: "json_object", reasoning: "low_effort", maxTokens: 4096, timeoutMs: 60_000 },
};

const KNOBS: ReasoningKnob[] = ["low_effort", "effort_low", "off", "default"];
const CALL_ENV = { extract: "REASONING_CALL_1", propose: "REASONING_CALL_2", message: "REASONING_CALL_3" } as const;

/**
 * The setting for one call, with the reasoning knob overridable per call (`REASONING_CALL_1/2/3`), because the knob
 * behaves differently per model: on Lightning, `low_effort` still reasons past a 4,096-token budget (stage T), while
 * Super and Ultra answer well inside it.
 */
export function callSetting(call: keyof typeof CALL_SETTINGS, env: NodeJS.ProcessEnv = process.env): CallSetting {
  const base = CALL_SETTINGS[call];
  const knob = env[CALL_ENV[call]]?.trim() as ReasoningKnob | undefined;
  return knob && KNOBS.includes(knob) ? { ...base, reasoning: knob } : base;
}

/** Input limits (architecture: credit-draining bot defence). */
export const MAX_AD_CHARS = 6000;
export const MIN_AD_CHARS = 40;
