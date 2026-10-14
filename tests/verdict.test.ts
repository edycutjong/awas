import { describe, expect, it } from "vitest";
import { decide, isCompanyMatched } from "@/lib/verdict";
import type { EvidenceLine, Flag } from "@/lib/types";

const span = { text: "visa turis", start: 0, end: 10 };
const flag = (id: Flag["id"], cls: Flag["class"], sourced: boolean): Flag => ({ id, class: cls, sourced, via: "pattern", span, label: "", source: null });
const line = (p: Partial<EvidenceLine>): EvidenceLine => ({
  url: "https://n.example/a", quote: "q", claim: "", status: "verified", entity: false, entityCapped: false, entityKind: null,
  negative: false, guard: false, chunkBasis: "page", purpose: "company", ...p,
});

describe("verdict truth table (first match wins)", () => {
  it("1. a sourced NEVER flag → STOP", () => {
    expect(decide([flag("tourist_visa", "NEVER", true)], [], []).verdict).toBe("STOP");
  });

  it("1b. a sourced NEVER flag still STOPs after a failed step", () => {
    expect(decide([flag("tourist_visa", "NEVER", true)], [], ["Tavily search (company)"]).verdict).toBe("STOP");
  });

  it("2. entity ∧ negative ∧ ¬guard → STOP, and the rule names the report", () => {
    const d = decide([], [line({ entity: true, entityKind: "company", negative: true })], []);
    expect(d.verdict).toBe("STOP");
    expect(d.rule).toContain("1 published report naming this company");
  });

  it("2b. both reasons are listed when both fired", () => {
    const d = decide([flag("tourist_visa", "NEVER", true)], [line({ entity: true, entityKind: "company", negative: true })], []);
    expect(d.rule).toBe("STOP — rule: tourist or visit visa offered for work + 1 published report naming this company");
  });

  it("3. an unsourced NEVER rule (drawn as CAUTION) → VERIFY FIRST", () => {
    expect(decide([flag("tourist_visa", "CAUTION", false)], [], []).verdict).toBe("VERIFY_FIRST");
  });

  it("3. any CAUTION flag → VERIFY FIRST", () => {
    expect(decide([flag("advisory_destination", "CAUTION", true)], [], []).verdict).toBe("VERIFY_FIRST");
  });

  it("3. entity with a guard term → VERIFY FIRST with the misuse reason", () => {
    const d = decide([], [line({ entity: true, entityKind: "company", negative: true, guard: true })], []);
    expect(d.verdict).toBe("VERIFY_FIRST");
    expect(d.rule).toContain("used by others or denied");
  });

  it("3. entity without a negative term → VERIFY FIRST", () => {
    expect(decide([], [line({ entity: true, entityKind: "company" })], []).verdict).toBe("VERIFY_FIRST");
  });

  it("3. a capped entity (generic name, ALL-CAPS, phone-only) never STOPs", () => {
    expect(decide([], [line({ entity: true, entityCapped: true, entityKind: "company", negative: true })], []).verdict).toBe("VERIFY_FIRST");
    expect(decide([], [line({ entity: true, entityCapped: true, entityKind: "phone", negative: true })], []).verdict).toBe("VERIFY_FIRST");
  });

  it("3. any failed step → VERIFY FIRST; NO RED FLAGS FOUND is impossible (invariant 3)", () => {
    const d = decide([], [], ["Tavily search (company)"]);
    expect(d.verdict).toBe("VERIFY_FIRST");
    expect(d.rule).toContain("step not completed");
  });

  it("4. nothing fired and every step completed → NO RED FLAGS FOUND, explicitly not a guarantee", () => {
    const d = decide([], [line({})], []);
    expect(d.verdict).toBe("NO_RED_FLAGS_FOUND");
    expect(d.rule).toContain("not a guarantee");
  });

  it("pattern-search lines are context only, never verdict input", () => {
    const l = line({ entity: true, entityKind: "company", negative: true, purpose: "pattern" });
    expect(isCompanyMatched(l)).toBe(false);
    expect(decide([], [l], []).verdict).toBe("NO_RED_FLAGS_FOUND");
  });

  it("a dropped line is never verdict input", () => {
    expect(decide([], [line({ status: "dropped", entity: true, entityKind: "company", negative: true })], []).verdict).toBe("NO_RED_FLAGS_FOUND");
  });
});
