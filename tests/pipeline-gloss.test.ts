/** Defensive branch: a gloss numbered past the lines that were sent is ignored (writeMessage is replaced to produce one). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/message", async (orig) => ({
  ...(await orig<typeof import("@/lib/message")>()),
  writeMessage: async () => ({
    messageId: "id", messageEn: "en", explanationEn: "ex", source: "model", receipt: null, error: null,
    glosses: new Map([[9, { gloss: "stray", ok: true }]]),
  }),
}));

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCheck } from "@/lib/pipeline";
import { localStore } from "@/lib/store";

describe("runCheck with a stray gloss number", () => {
  it("leaves every line untouched and still finishes", async () => {
    const events: { event: string; data: unknown }[] = [];
    const pack = await runCheck(
      { adText: "Lowongan CS online di Kamboja, gaji besar, kirim lamaran ke kantor kami.", lang: "id", mode: "live", stage: "full" },
      { tf: null, tavily: null, store: localStore(mkdtempSync(path.join(tmpdir(), "awas-test-"))) },
      (event, data) => events.push({ event, data }),
    );
    expect(pack.done).toBe(true);
    expect((events.find((e) => e.event === "message")!.data as { glosses: object }).glosses).toEqual({});
  });
});
