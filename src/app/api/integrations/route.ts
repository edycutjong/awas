import { loadStorageConfig, loadTavilyConfig, loadTokenFactoryConfig } from "@/lib/nebius/config";
import { CREDIT_ALARM, getStore, monthKey } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Sponsor verification: the last 20 live runs' anonymised receipts and this month's Tavily credits (spend alarm). */
export async function GET() {
  const store = getStore();
  const month = monthKey();
  const [receipts, credits] = await Promise.all([store.recentReceipts(20), store.getCredits(month)]);
  const tf = loadTokenFactoryConfig();
  const tavily = loadTavilyConfig();
  const storage = loadStorageConfig();
  return Response.json(
    {
      tokenFactory: tf ? { configured: true, models: tf.models } : { configured: false },
      tavily: tavily ? { configured: true, access: tavily.access } : { configured: false },
      objectStorage: storage.configured ? { configured: true, bucket: storage.config.bucket, region: storage.config.region } : { configured: false, store: store.kind },
      month,
      tavilyCreditsThisMonth: credits,
      creditAlarm: { threshold: CREDIT_ALARM, tripped: credits >= CREDIT_ALARM },
      receipts,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
