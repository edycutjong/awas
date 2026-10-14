/** Shared types. The EvidencePack is the one document a check produces; every surface renders from it. */

/** A piece of the pasted ad, located by code: `text` is exactly `adText.slice(start, end)`. */
export interface Span {
  text: string;
  start: number;
  end: number;
}

export interface Extraction {
  isJobOffer: boolean;
  company?: Span;
  recruiter?: Span;
  phones: Span[];
  destination?: Span;
  job?: Span;
  visa?: Span;
  fees: Span[];
  promises: Span[];
  /** Fields the model returned whose text is not a substring of the ad — dropped, never used. */
  droppedFields: string[];
}

export type FlagId =
  | "tourist_visa"
  | "fee_before_contract"
  | "passport_retention"
  | "fee_before_departure"
  | "high_pay_no_experience"
  | "advisory_destination"
  | "personal_recruiter"
  | "visit_visa_holder";

export type FlagClass = "NEVER" | "CAUTION";

export interface RuleSource {
  url: string;
  domain: string;
  title: string;
  date: string;
  quote: string;
}

export interface Flag {
  id: FlagId;
  /** The class the verdict uses: a NEVER rule with no recorded source is drawn and counted as CAUTION. */
  class: FlagClass;
  sourced: boolean;
  via: "model" | "pattern" | "both";
  span: Span;
  label: string;
  source: RuleSource | null;
}

export type TavilyMethod = "search" | "extract";

export interface TavilyReceipt {
  method: TavilyMethod;
  purpose: "company" | "phone" | "pattern" | "advisory";
  params: Record<string, unknown>;
  credits: number | null;
  ms: number;
  urls: string[];
  access: "key" | "keyless";
  requestId?: string;
  error?: string;
}

export type DropReason = "not_in_page" | "url_not_returned" | "too_short" | "spans_chunks";

export interface EvidenceLine {
  url: string;
  title?: string;
  quote: string;
  claim: string;
  status: "verified" | "dropped";
  reason?: DropReason;
  entity: boolean;
  /** The entity match counts toward VERIFY FIRST only: phone-only, a generic name, or ALL-CAPS text. */
  entityCapped: boolean;
  entityKind: "company" | "phone" | null;
  negative: boolean;
  guard: boolean;
  chunkBasis: "page" | "ranked";
  pageSha256?: string;
  matchOffset?: number;
  /** `url#:~:text=<start>,<end>` — makes the browser highlight the quote on the source page. */
  fragmentUrl?: string;
  gloss?: string;
  glossStatus?: "ok" | "unavailable";
  /** Set by scripts/fragment_check (Playwright) when the text-fragment link was seen to highlight the quote. */
  fragmentFoundAt?: string;
  purpose?: TavilyReceipt["purpose"];
}

export type Verdict = "STOP" | "VERIFY_FIRST" | "NO_RED_FLAGS_FOUND";

export type Mode = "live" | "bench" | "sample";

export type Stage = "rubric" | "extract" | "full";

export interface TfCallReceipt {
  call: "extract" | "propose" | "message";
  model: string;
  requestId?: string;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  ms: number;
  format: string;
  attempts: number;
  error?: string;
}

export interface Receipt {
  models: string[];
  tfCalls: number;
  tfTokens: number;
  tavilyCredits: number;
  ms: number;
  failedSteps: string[];
  tf: TfCallReceipt[];
}

export interface PickerResult {
  lines: { url: string; quote: string }[];
  companyMatched: boolean;
}

export interface EvidencePack {
  id: string;
  createdAt: string;
  mode: Mode;
  stage: Stage;
  lang: "id" | "en";
  adSha256: string;
  adTextMasked: string;
  extraction: Extraction | null;
  flags: Flag[];
  tavily: TavilyReceipt[];
  lines: EvidenceLine[];
  verdict: Verdict | null;
  rule: string;
  verifySteps: string[];
  messageId: string;
  messageEn: string;
  explanationEn: string;
  messageSource: "model" | "template" | null;
  picker?: PickerResult;
  receipt: Receipt;
  /** Recorded samples only: when the real run was recorded. */
  recordedAt?: string;
  /** Recorded samples only: what the sample is (shown on /judge). */
  sampleLabel?: string;
  done: boolean;
}
