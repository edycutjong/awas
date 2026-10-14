/**
 * Configuration, read once from the environment.
 *
 * Resolution never throws. A judge opening the deploy with nothing configured still gets the
 * recorded sample cases, and a live check names exactly which step could not run instead of
 * returning a stack trace. Adapted from faultline's config.ts (same author): the Object Storage
 * and service-account shapes are unchanged, the probe-specific settings are gone.
 */

/** Object Storage (S3-compatible): evidence packs, per-IP rate slots, recorded samples. */
export interface StorageConfig {
  bucket: string;
  region: string;
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
}

/** Service-account credentials for the Nebius REST API (Serverless Jobs). */
export interface NebiusConfig extends StorageConfig {
  /** Service account ID — the JWT `iss` and `sub`. */
  serviceAccountId: string;
  /** Authorized (public) key ID — the JWT `kid`. */
  authKeyId: string;
  /** PEM contents of the RSA private key that signs the JWT. */
  privateKeyPem: string;
  /** Project the bench job runs in (`metadata.parentId`). */
  projectId: string;
  /** Required by the Jobs API when the project has more than one subnet. */
  subnetId: string;
}

/** Where a job runs: a region, a project in it and a subnet. */
export interface JobTarget {
  region: string;
  projectId: string;
  subnetId: string;
}

export type ConfigResult<T> = { configured: true; config: T } | { configured: false; missing: string[] };

/** The bucket lives in eu-west1 next to faultline's (same tenant, its own bucket). */
export const DEFAULT_REGION = "eu-west1";

const STORAGE_REQUIRED = ["NEBIUS_BUCKET", "NEBIUS_S3_ACCESS_KEY_ID", "NEBIUS_S3_SECRET_ACCESS_KEY"] as const;

export function loadStorageConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult<StorageConfig> {
  const missing = STORAGE_REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length > 0) return { configured: false, missing: [...missing] };
  const region = env.NEBIUS_REGION?.trim() || DEFAULT_REGION;
  return {
    configured: true,
    config: {
      bucket: req(env, "NEBIUS_BUCKET"),
      region,
      s3Endpoint: env.NEBIUS_S3_ENDPOINT?.trim() || `https://storage.${region}.nebius.cloud`,
      s3AccessKeyId: req(env, "NEBIUS_S3_ACCESS_KEY_ID"),
      s3SecretAccessKey: req(env, "NEBIUS_S3_SECRET_ACCESS_KEY"),
    },
  };
}

const NEBIUS_REQUIRED = [
  ...STORAGE_REQUIRED,
  "NEBIUS_SERVICE_ACCOUNT_ID",
  "NEBIUS_AUTH_KEY_ID",
  "NEBIUS_AUTH_PRIVATE_KEY",
  "NEBIUS_PROJECT_ID",
  "NEBIUS_SUBNET_ID",
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult<NebiusConfig> {
  const missing = NEBIUS_REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length > 0) return { configured: false, missing: [...missing] };
  const storage = loadStorageConfig(env);
  /* v8 ignore next */
  if (!storage.configured) return storage;
  return {
    configured: true,
    config: {
      ...storage.config,
      serviceAccountId: req(env, "NEBIUS_SERVICE_ACCOUNT_ID"),
      authKeyId: req(env, "NEBIUS_AUTH_KEY_ID"),
      // A PEM pasted with `\n` escapes is unescaped; one stored with real newlines is untouched.
      privateKeyPem: req(env, "NEBIUS_AUTH_PRIVATE_KEY").replace(/\\n/g, "\n"),
      projectId: req(env, "NEBIUS_PROJECT_ID"),
      subnetId: req(env, "NEBIUS_SUBNET_ID"),
    },
  };
}

/**
 * The bench job's target, `region:project:subnet`. It is NOT the bucket's region: faultline's
 * live app owns eu-west1's two job slots, so the bench runs in uk-south1 and returns its result
 * through a presigned URL, which needs no private route to the bucket.
 */
export function parseJobTarget(raw: string | undefined): JobTarget | null {
  const [region, projectId, subnetId, ...rest] = (raw ?? "").trim().split(":");
  if (rest.length > 0 || !region || !projectId?.startsWith("project-") || !subnetId?.startsWith("vpcsubnet-")) {
    return null;
  }
  return { region, projectId, subnetId };
}

function req(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  // unreachable: callers reject blank/missing keys before req() runs
  /* v8 ignore next */
  if (!v) throw new Error(`missing required env var ${key}`);
  return v.trim();
}

export const NEBIUS_API_BASE = "https://api.nebius.cloud";
export const NEBIUS_TOKEN_EXCHANGE_URL = "https://auth.eu.nebius.com/oauth2/token/exchange";

/** Non-GPU AMD EPYC Genoa, and its smallest preset — the bench is stdlib Python over HTTP. */
export const JOB_PLATFORM = "cpu-d3";
export const JOB_PRESET = "2vcpu-8gb";

/* ------------------------------------------------------------------------------------------ */
/* Token Factory                                                                              */
/* ------------------------------------------------------------------------------------------ */

export const TOKEN_FACTORY_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
export const SUPER = "nvidia/nemotron-3-super-120b-a12b";
export const LIGHTNING = "nvidia/Nemotron-3_5-Lightning";

/**
 * The model is a per-call setting (spec §9). Call 1 extracts fields from the ad, call 2 proposes
 * evidence lines over the fetched pages, call 3 writes the explanation and the family message.
 * The defaults are the routing that stage T and the day-1 checks selected; docs/proof records why.
 */
export interface TokenFactoryConfig {
  apiKey: string;
  baseUrl: string;
  models: { extract: string; propose: string; message: string };
}

export const DEFAULT_MODELS: TokenFactoryConfig["models"] = { extract: SUPER, propose: SUPER, message: SUPER };

export function loadTokenFactoryConfig(env: NodeJS.ProcessEnv = process.env): TokenFactoryConfig | null {
  const apiKey = env.TOKENFACTORY_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.TOKENFACTORY_BASE_URL?.trim() || TOKEN_FACTORY_BASE_URL).replace(/\/+$/, ""),
    models: {
      extract: env.MODEL_CALL_1?.trim() || DEFAULT_MODELS.extract,
      propose: env.MODEL_CALL_2?.trim() || DEFAULT_MODELS.propose,
      message: env.MODEL_CALL_3?.trim() || DEFAULT_MODELS.message,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Tavily                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export const TAVILY_BASE_URL = "https://api.tavily.com";

/**
 * Tavily authenticates with a Bearer key. Without one, `/search` and `/extract` also accept the
 * documented keyless mode (`X-Tavily-Access-Mode: keyless`: same responses, lower limits). Keyless
 * is used only when explicitly enabled, and every receipt records which mode served the call.
 */
export interface TavilyConfig {
  baseUrl: string;
  access: "key" | "keyless";
  apiKey: string | null;
}

export function loadTavilyConfig(env: NodeJS.ProcessEnv = process.env): TavilyConfig | null {
  const baseUrl = (env.TAVILY_BASE_URL?.trim() || TAVILY_BASE_URL).replace(/\/+$/, "");
  const apiKey = env.TAVILY_API_KEY?.trim();
  if (apiKey) return { baseUrl, access: "key", apiKey };
  if (env.TAVILY_ACCESS?.trim().toLowerCase() === "keyless") return { baseUrl, access: "keyless", apiKey: null };
  return null;
}
