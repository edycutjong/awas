import { loadStorageConfig, loadTavilyConfig, loadTokenFactoryConfig } from "@/lib/nebius/config";

export const dynamic = "force-dynamic";

/** Liveness plus which upstreams are configured — names only, never a value. */
export function GET() {
  const tf = loadTokenFactoryConfig();
  const tavily = loadTavilyConfig();
  const storage = loadStorageConfig();
  return Response.json({
    ok: true,
    tokenFactory: tf ? { configured: true, models: tf.models } : { configured: false },
    tavily: tavily ? { configured: true, access: tavily.access } : { configured: false },
    objectStorage: storage.configured ? { configured: true, bucket: storage.config.bucket } : { configured: false },
  });
}
