import { after } from "next/server";
import { loadTavilyConfig, loadTokenFactoryConfig } from "@/lib/nebius/config";
import { runCheck, type CheckInput } from "@/lib/pipeline";
import { clientIp, getStore, hourKey, ipHash, isBench, isJudge, monthKey, toIntegrationReceipt } from "@/lib/store";
import type { Stage } from "@/lib/types";

export const dynamic = "force-dynamic";
// The function limit read on the first deploy (docs/proof); the pipeline keeps a margin inside it.
export const maxDuration = 300;
const BUDGET_MS = (maxDuration - 15) * 1000;

const STAGES: Stage[] = ["rubric", "extract", "full"];

interface Body {
  adText?: unknown;
  lang?: unknown;
  stage?: unknown;
  exclude?: { domain?: unknown; title?: unknown };
  endDate?: unknown;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "body must be JSON: {adText, lang}" }, { status: 400 });
  }
  const adText = typeof body.adText === "string" ? body.adText : "";
  const lang = body.lang === "en" ? "en" : "id";
  const bench = isBench(req.headers.get("x-awas-bench"));
  const url = new URL(req.url);
  const judge = isJudge(url.searchParams.get("judge") ?? req.headers.get("x-awas-judge"));

  const input: CheckInput = { adText, lang, mode: bench ? "bench" : "live", stage: "full" };
  if (bench) {
    if (typeof body.stage === "string" && STAGES.includes(body.stage as Stage)) input.stage = body.stage as Stage;
    if (body.exclude && typeof body.exclude.domain === "string" && typeof body.exclude.title === "string") {
      input.exclude = { domain: body.exclude.domain, title: body.exclude.title };
    }
    if (typeof body.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) input.endDate = body.endDate;
  }

  const store = getStore();
  const encoder = new TextEncoder();
  let finalPack: Awaited<ReturnType<typeof runCheck>> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // The reader went away; the pack is still written step by step.
        }
      };
      try {
        if (!bench && !judge) {
          const day = new Date().toISOString().slice(0, 10);
          const ok = await store.claimRateSlot(ipHash(clientIp(req.headers), day), hourKey());
          if (!ok) {
            send("rate_limited", { message: "too many checks from this connection — try a recorded sample or wait" });
            send("done", { caseId: null });
            controller.close();
            return;
          }
        }
        finalPack = await runCheck(input, { tf: loadTokenFactoryConfig(), tavily: loadTavilyConfig(), store, budgetMs: BUDGET_MS }, send);
      } catch (e) {
        send("step_error", { step: "server", message: e instanceof Error ? e.message : String(e) });
        send("done", { caseId: null });
      }
      controller.close();
    },
  });

  // Receipts for /integrations and the monthly credit ledger (spend alarm) are written after the response.
  after(async () => {
    const pack = finalPack;
    if (!pack || !pack.done) return;
    try {
      if (pack.mode === "live") await store.putReceipt(toIntegrationReceipt(pack, pack.receipt));
      if (pack.receipt.tavilyCredits > 0) await store.addCredits(monthKey(), pack.receipt.tavilyCredits);
    } catch {
      // Best effort; the evidence pack itself is already stored.
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
