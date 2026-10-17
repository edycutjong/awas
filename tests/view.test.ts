import { describe, expect, it } from "vitest";
import { emptyView, reduce, viewFromPack, readEvents } from "@/lib/view";

/* eslint-disable @typescript-eslint/no-explicit-any */
const base = () => emptyView("ad");

describe("view reducer", () => {
  it("emptyView defaults adText", () => {
    expect(emptyView().adText).toBe("");
    expect(base().status).toBe("idle");
  });

  it("started / extracted / flags / rule_stop", () => {
    let v = reduce(base(), "started", { caseId: "c1", mode: "recorded" });
    expect(v).toMatchObject({ status: "running", caseId: "c1", mode: "recorded" });
    v = reduce(base(), "started", {});
    expect(v).toMatchObject({ caseId: null, mode: "live" });
    expect(reduce(base(), "extracted", { extraction: { a: 1 } }).extraction).toEqual({ a: 1 });
    expect(reduce(base(), "extracted", {}).extraction).toBeNull();
    const f = reduce(base(), "flags", { flags: [{ id: "x" }], registry: { r: 1 } });
    expect(f.flags).toHaveLength(1);
    expect(f.registry).toEqual({ r: 1 });
    const f2 = reduce(base(), "flags", {});
    expect(f2.flags).toEqual([]);
    expect(f2.registry).toBeNull();
    expect(reduce(base(), "rule_stop", { flags: ["a"] }).ruleStop).toEqual(["a"]);
    expect(reduce(base(), "rule_stop", {}).ruleStop).toEqual([]);
  });

  it("tavily_call and line lifecycle", () => {
    let v = reduce(base(), "tavily_call", { call: { q: 1 } });
    expect(v.tavily).toEqual([{ q: 1 }]);
    v = reduce(v, "line_pending", { index: 1, url: "u1", quote: "q1" });
    v = reduce(v, "line_pending", { index: 0, url: "u0", quote: "q0" });
    v = reduce(v, "line_pending", { index: 1, url: "u1b", quote: "q1b" });
    expect(v.lines.map((l) => l.index)).toEqual([0, 1]);
    expect(v.lines[1].url).toBe("u1b");
    v = reduce(v, "line_verified", { index: 0, line: { extra: "e" } });
    v = reduce(v, "line_dropped", { index: 1, line: {} });
    expect(v.lines[0]).toMatchObject({ state: "verified", extra: "e" });
    expect(v.lines[1].state).toBe("dropped");
  });

  it("verdict, message with glosses, receipt, errors", () => {
    let v = reduce(base(), "verdict", { verdict: "STOP", rule: "r", reasons: ["a"], steps: ["s"] });
    expect(v).toMatchObject({ verdict: "STOP", rule: "r", reasons: ["a"], steps: ["s"] });
    expect(reduce(base(), "verdict", { verdict: "X", rule: "r" })).toMatchObject({ reasons: [], steps: [] });
    v = reduce(v, "line_pending", { index: 0, url: "u", quote: "q" });
    v = reduce(v, "line_verified", { index: 0, line: {} });
    v = reduce(v, "line_pending", { index: 1, url: "u", quote: "q" });
    v = reduce(v, "line_verified", { index: 1, line: {} });
    v = reduce(v, "line_pending", { index: 2, url: "u", quote: "q" });
    v = reduce(v, "line_dropped", { index: 2, line: {} });
    v = reduce(v, "message", {
      messageId: "id", messageEn: "en", explanationEn: "ex", source: "model",
      glosses: { "0": { gloss: "g", ok: true }, "1": { gloss: "g", ok: false }, "2": { gloss: "g", ok: true } },
    });
    expect(v.messageId).toBe("id");
    expect(v.lines[0]).toMatchObject({ gloss: "g", glossStatus: "ok" });
    expect(v.lines[1]).toMatchObject({ gloss: undefined, glossStatus: "unavailable" });
    expect(v.lines[2].gloss).toBeUndefined();
    let w = reduce(base(), "line_pending", { index: 0, url: "u", quote: "q" });
    w = reduce(w, "line_verified", { index: 0, line: {} });
    const m = reduce(w, "message", { messageId: "i", messageEn: "e", explanationEn: "x", source: "template" });
    expect(m.lines[0].glossStatus).toBeUndefined();
    expect(reduce(base(), "receipt", { receipt: { r: 1 } }).receipt).toEqual({ r: 1 });
    expect(reduce(base(), "step_error", { step: "s", message: "m" }).errors).toEqual([{ step: "s", message: "m" }]);
    expect(reduce(base(), "step_error", { step: "s" }).errors).toEqual([{ step: "s", message: "" }]);
  });

  it("status events and done", () => {
    expect(reduce(base(), "rate_limited", {}).status).toBe("rate_limited");
    const b = reduce(base(), "bad_input", { reason: "why" });
    expect(b).toMatchObject({ status: "bad_input", badInput: "why" });
    expect(reduce(b, "done", { caseId: "c" })).toMatchObject({ status: "bad_input", caseId: "c" });
    expect(reduce(reduce(base(), "rate_limited", {}), "done", {}).status).toBe("rate_limited");
    expect(reduce(base(), "done", { caseId: "c" }).status).toBe("done");
    const e = reduce({ ...base(), caseId: "old" }, "done", {});
    expect(e).toMatchObject({ status: "error", caseId: "old" });
    const v = base();
    expect(reduce(v, "unknown", {})).toBe(v);
  });
});

describe("viewFromPack", () => {
  const pack: any = {
    adTextMasked: "masked", done: true, extraction: { e: 1 },
    flags: [{ id: "n", class: "NEVER" }, { id: "o", class: "OTHER" }],
    tavily: [], lines: [{ status: "verified", url: "u" }], verdict: "STOP", rule: "r", verifySteps: ["s"],
    messageId: "m", messageEn: "e", explanationEn: "x", messageSource: "model",
    receipt: { failedSteps: ["a"] }, id: "case", mode: "live",
  };
  it("maps a full pack", () => {
    const v = viewFromPack(pack);
    expect(v).toMatchObject({ status: "done", adText: "masked", ruleStop: ["n"], caseId: "case", recordedAt: null, sampleLabel: null, registry: null });
    expect(v.lines[0]).toMatchObject({ index: 0, state: "verified" });
    expect(v.errors).toEqual([{ step: "a", message: "" }]);
  });
  it("maps an incomplete pack with optional fields", () => {
    const v = viewFromPack({ ...pack, done: false, recordedAt: "t", sampleLabel: "L", registry: { r: 1 } });
    expect(v).toMatchObject({ status: "error", recordedAt: "t", sampleLabel: "L", registry: { r: 1 } });
  });
});

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("readEvents", () => {
  it("parses events across chunk boundaries, defaults, multi-line data, malformed", async () => {
    const got: [string, unknown][] = [];
    await readEvents(
      stream([
        'event: a\ndata: {"x":1}\n\nda', 'ta: {"y":2}\n\n',
        "event: b\ndata: {\ndata: \"z\":3}\n\n", "event: c\n\n", "event: d\ndata: {bad\n\n",
      ]),
      (e, d) => got.push([e, d]),
    );
    expect(got).toEqual([["a", { x: 1 }], ["message", { y: 2 }], ["b", { z: 3 }], ["c", null]]);
  });
});
