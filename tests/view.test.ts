import { describe, expect, it } from "vitest";
import { emptyView, readEvents, reduce, viewFromPack } from "@/lib/view";
import type { EvidencePack, Extraction, Flag, TavilyReceipt, Receipt, Verdict } from "@/lib/types";

describe("emptyView", () => {
  it("creates a view with default empty state", () => {
    const v = emptyView();
    expect(v.status).toBe("idle");
    expect(v.adText).toBe("");
    expect(v.extraction).toBeNull();
    expect(v.flags).toEqual([]);
    expect(v.lines).toEqual([]);
    expect(v.errors).toEqual([]);
  });

  it("accepts custom adText", () => {
    const v = emptyView("test ad");
    expect(v.adText).toBe("test ad");
  });
});

describe("reduce", () => {
  const v0 = emptyView();

  it("handles started event", () => {
    const v = reduce(v0, "started", { caseId: "case-123", mode: "recorded" });
    expect(v.status).toBe("running");
    expect(v.caseId).toBe("case-123");
    expect(v.mode).toBe("recorded");
  });

  it("handles started without caseId", () => {
    const v = reduce(v0, "started", {});
    expect(v.caseId).toBeNull();
  });

  it("handles extracted event", () => {
    const extraction: Extraction = { companyName: "Test Co", destination: "Thailand" };
    const v = reduce(v0, "extracted", { extraction });
    expect(v.extraction).toEqual(extraction);
  });

  it("handles flags event", () => {
    const flags: Flag[] = [{ id: "HIGH_PAY", class: "CAUTION", phrase: "high salary" }];
    const registry = { Thailand: "CAUTION" };
    const v = reduce(v0, "flags", { flags, registry });
    expect(v.flags).toEqual(flags);
    expect(v.registry).toEqual(registry);
  });

  it("handles rule_stop event", () => {
    const v = reduce(v0, "rule_stop", { flags: ["NEVER_1", "NEVER_2"] });
    expect(v.ruleStop).toEqual(["NEVER_1", "NEVER_2"]);
  });

  it("handles tavily_call event", () => {
    const call: TavilyReceipt = { query: "test", credits: 1, accessMode: "key" };
    const v1 = reduce(v0, "tavily_call", { call });
    expect(v1.tavily).toHaveLength(1);
    const v2 = reduce(v1, "tavily_call", { call });
    expect(v2.tavily).toHaveLength(2);
  });

  it("handles line_pending event", () => {
    const v = reduce(v0, "line_pending", { index: 0, url: "https://example.com", quote: "test quote" });
    expect(v.lines).toHaveLength(1);
    expect(v.lines[0]).toMatchObject({ index: 0, state: "pending", quote: "test quote" });
  });

  it("replaces line_pending when updating same index", () => {
    let v = reduce(v0, "line_pending", { index: 0, url: "https://a.com", quote: "quote a" });
    v = reduce(v, "line_pending", { index: 0, url: "https://b.com", quote: "quote b" });
    expect(v.lines).toHaveLength(1);
    expect(v.lines[0].quote).toBe("quote b");
  });

  it("sorts lines by index", () => {
    let v = reduce(v0, "line_pending", { index: 2, url: "https://c.com", quote: "c" });
    v = reduce(v, "line_pending", { index: 0, url: "https://a.com", quote: "a" });
    v = reduce(v, "line_pending", { index: 1, url: "https://b.com", quote: "b" });
    expect(v.lines.map((l) => l.index)).toEqual([0, 1, 2]);
  });

  it("handles line_verified event", () => {
    let v = reduce(v0, "line_pending", { index: 0, url: "https://example.com", quote: "test" });
    v = reduce(v, "line_verified", { index: 0, line: { foundOn: "https://example.com", evidence: "found" } });
    expect(v.lines[0].state).toBe("verified");
    expect(v.lines[0].foundOn).toBe("https://example.com");
  });

  it("handles line_dropped event", () => {
    let v = reduce(v0, "line_pending", { index: 0, url: "https://example.com", quote: "test" });
    v = reduce(v, "line_dropped", { index: 0, line: { reason: "not found" } });
    expect(v.lines[0].state).toBe("dropped");
  });

  it("handles verdict event", () => {
    const verdict: Verdict = "STOP";
    const v = reduce(v0, "verdict", { verdict, rule: "NEVER_1", reasons: ["reason 1"], steps: ["step 1"] });
    expect(v.verdict).toBe("STOP");
    expect(v.rule).toBe("NEVER_1");
    expect(v.reasons).toEqual(["reason 1"]);
    expect(v.steps).toEqual(["step 1"]);
  });

  it("handles message event and applies glosses", () => {
    let v = reduce(v0, "line_pending", { index: 0, url: "https://example.com", quote: "test" });
    v = reduce(v, "line_verified", { index: 0, line: {} });
    v = reduce(v, "message", {
      messageId: "msg-123",
      messageEn: "Indonesian message",
      explanationEn: "English explanation",
      source: "model",
      glosses: { "0": { gloss: "this means", ok: true } },
    });
    expect(v.messageId).toBe("msg-123");
    expect(v.messageSource).toBe("model");
    expect(v.lines[0].gloss).toBe("this means");
    expect(v.lines[0].glossStatus).toBe("ok");
  });

  it("marks gloss as unavailable when ok is false", () => {
    let v = reduce(v0, "line_pending", { index: 0, url: "https://example.com", quote: "test" });
    v = reduce(v, "line_verified", { index: 0, line: {} });
    v = reduce(v, "message", {
      messageId: "msg-123",
      messageEn: "text",
      explanationEn: "exp",
      source: "template",
      glosses: { "0": { gloss: "", ok: false } },
    });
    expect(v.lines[0].glossStatus).toBe("unavailable");
  });

  it("handles receipt event", () => {
    const receipt: Receipt = { elapsedSeconds: 10, creditsUsed: 50, failedSteps: [] };
    const v = reduce(v0, "receipt", { receipt });
    expect(v.receipt).toEqual(receipt);
  });

  it("handles step_error event", () => {
    const v = reduce(v0, "step_error", { step: "tavily", message: "rate limited" });
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0]).toEqual({ step: "tavily", message: "rate limited" });
  });

  it("handles rate_limited event", () => {
    const v = reduce(v0, "rate_limited", {});
    expect(v.status).toBe("rate_limited");
  });

  it("handles bad_input event", () => {
    const v = reduce(v0, "bad_input", { reason: "text too long" });
    expect(v.status).toBe("bad_input");
    expect(v.badInput).toBe("text too long");
  });

  it("handles done event with caseId", () => {
    let v = reduce(v0, "running", {});
    v = reduce(v, "done", { caseId: "case-456" });
    expect(v.status).toBe("done");
    expect(v.caseId).toBe("case-456");
  });

  it("handles done event without caseId", () => {
    let v = reduce(v0, "started", {});
    v = reduce(v, "done", {});
    expect(v.status).toBe("error");
  });

  it("preserves status when done with rate_limited", () => {
    let v = reduce(v0, "rate_limited", {});
    v = reduce(v, "done", { caseId: "case-456" });
    expect(v.status).toBe("rate_limited");
  });

  it("ignores unknown event", () => {
    const v = reduce(v0, "unknown_event", { data: "test" });
    expect(v).toEqual(v0);
  });
});

describe("viewFromPack", () => {
  const pack: EvidencePack = {
    id: "pack-123",
    adTextMasked: "test ad",
    extraction: { companyName: "Test Co", destination: "Thailand" },
    flags: [{ id: "HIGH_PAY", class: "CAUTION", phrase: "high" }],
    rule: "CAUTION",
    verifySteps: ["verify 1"],
    tavily: [{ query: "test", credits: 1, accessMode: "key" }],
    lines: [
      { status: "verified", url: "https://example.com", quote: "found quote", foundOn: "https://example.com", evidence: "evidence text" },
      { status: "dropped", url: "https://example2.com", quote: "not found", reason: "not on page" },
    ],
    verdict: "STOP",
    messageId: "msg-123",
    messageEn: "ID message",
    explanationEn: "EN message",
    messageSource: "model",
    receipt: { elapsedSeconds: 15, creditsUsed: 75, failedSteps: [] },
    mode: "recorded",
    recordedAt: "2026-01-01T00:00:00Z",
    sampleLabel: "test-sample",
    registry: { Thailand: "CAUTION" },
    done: true,
  };

  it("creates a view from a complete pack", () => {
    const v = viewFromPack(pack);
    expect(v.status).toBe("done");
    expect(v.adText).toBe("test ad");
    expect(v.extraction).toEqual(pack.extraction);
    expect(v.flags).toEqual(pack.flags);
    expect(v.caseId).toBe("pack-123");
    expect(v.recordedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("maps lines with correct indices and states", () => {
    const v = viewFromPack(pack);
    expect(v.lines).toHaveLength(2);
    expect(v.lines[0]).toMatchObject({ index: 0, state: "verified" });
    expect(v.lines[1]).toMatchObject({ index: 1, state: "dropped" });
  });

  it("filters rule stops from flags", () => {
    const packWithStops = {
      ...pack,
      flags: [
        { id: "NEVER_1", class: "NEVER", phrase: "prohibited" },
        { id: "CAUTION_1", class: "CAUTION", phrase: "warning" },
      ],
    };
    const v = viewFromPack(packWithStops);
    expect(v.ruleStop).toEqual(["NEVER_1"]);
  });

  it("handles missing optional fields", () => {
    const minimal: EvidencePack = {
      id: "pack-123",
      adTextMasked: "ad",
      extraction: null,
      flags: [],
      rule: "",
      verifySteps: [],
      tavily: [],
      lines: [],
      verdict: null,
      messageId: "",
      messageEn: "",
      explanationEn: "",
      messageSource: null,
      receipt: { elapsedSeconds: 0, creditsUsed: 0, failedSteps: [] },
      mode: "live",
      done: false,
    };
    const v = viewFromPack(minimal);
    expect(v.recordedAt).toBeNull();
    expect(v.sampleLabel).toBeNull();
    expect(v.registry).toBeNull();
  });
});

describe("readEvents", () => {
  it("parses simple SSE events", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: test\ndata: {"key":"value"}\n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(["test", { key: "value" }]);
  });

  it("defaults to message event", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"default":true}\n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events[0][0]).toBe("message");
  });

  it("handles multi-line data", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"line1":\n\ndata: "line2"}\n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events).toHaveLength(1);
  });

  it("skips malformed JSON", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {invalid json}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"valid":true}\n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(["message", { valid: true }]);
  });

  it("handles null data", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: \n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events[0][1]).toBeNull();
  });

  it("handles chunked data", async () => {
    const events: Array<[string, unknown]> = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: ch'));
        controller.enqueue(new TextEncoder().encode('unk\ndata: {"part":'));
        controller.enqueue(new TextEncoder().encode('"1"}\n\n'));
        controller.close();
      },
    });
    await readEvents(body, (event, data) => events.push([event, data]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(["chunk", { part: "1" }]);
  });
});
