/** A quote that has enough "words" but normalises to nothing is dropped as too short (defensive; words() derives from normalise). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/text", async (orig) => {
  const real = await orig<typeof import("@/lib/text")>();
  return { ...real, words: (s: string) => (s === "***" ? ["a", "b", "c", "d", "e", "f"] : real.words(s)) };
});

import { addToCorpus, gateLine, type Corpus } from "@/lib/gate";

describe("gateLine defensive guard", () => {
  it("drops a quote whose normalised form is empty even if it counted six words", () => {
    const c: Corpus = new Map();
    addToCorpus(c, "https://a.example/x", "company", { pageText: "something" });
    const l = gateLine({ url: "https://a.example/x", quote: "", claim: "" }, c, { phones: [] });
    expect(l.status).toBe("dropped");
    const stubbed = gateLine({ url: "https://a.example/x", quote: "***", claim: "" }, c, { phones: [] });
    expect(stubbed).toMatchObject({ status: "dropped", reason: "too_short" });
  });
});
