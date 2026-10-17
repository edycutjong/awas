/** Defensive branch: sources exist but Token Factory is not configured (filterCorpus is replaced to reach it). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/propose", async (orig) => ({
  ...(await orig<typeof import("@/lib/propose")>()),
  filterCorpus: () => [{ id: "S1", url: "https://news.example.org/a", title: "t", paragraphs: ["p"] }],
}));

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCheck } from "@/lib/pipeline";
import { localStore } from "@/lib/store";

describe("runCheck with sources but no Token Factory", () => {
  it("names the missing proposal step and still ends with a verdict", async () => {
    const pack = await runCheck(
      { adText: "Lowongan CS online di Kamboja, gaji besar, kirim lamaran ke kantor kami.", lang: "id", mode: "live", stage: "full" },
      { tf: null, tavily: { baseUrl: "https://tv.test", access: "key", apiKey: "k" }, store: localStore(mkdtempSync(path.join(tmpdir(), "awas-test-"))) },
    );
    expect(pack.receipt.failedSteps).toContain("evidence proposal (Token Factory not configured)");
    expect(pack.verdict).not.toBeNull();
  });
});
