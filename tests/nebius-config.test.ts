import { describe, expect, it, vi } from "vitest";
import {
  loadConfig,
  loadStorageConfig,
  loadTokenFactoryConfig,
  loadTavilyConfig,
  parseJobTarget,
  DEFAULT_REGION,
  TOKEN_FACTORY_BASE_URL,
  DEFAULT_MODELS,
  TAVILY_BASE_URL,
} from "@/lib/nebius/config";

const E = (o: Record<string, string | undefined>) => o as NodeJS.ProcessEnv;
const ENV: Record<string, string> = {
  NEBIUS_BUCKET: "test-bucket",
  NEBIUS_S3_ACCESS_KEY_ID: "AK",
  NEBIUS_S3_SECRET_ACCESS_KEY: "SK",
  NEBIUS_SERVICE_ACCOUNT_ID: "sa-1",
  NEBIUS_AUTH_KEY_ID: "key-1",
  NEBIUS_AUTH_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  NEBIUS_PROJECT_ID: "project-1",
  NEBIUS_SUBNET_ID: "vpcsubnet-1",
};

describe("loadStorageConfig", () => {
  it("returns missing variables for unconfigured storage", () => {
    expect(loadStorageConfig(E({}))).toMatchObject({ configured: false });
    const r = loadStorageConfig(E({ NEBIUS_BUCKET: "" }));
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toContain("NEBIUS_BUCKET");
      expect(r.missing).toContain("NEBIUS_S3_ACCESS_KEY_ID");
      expect(r.missing).toContain("NEBIUS_S3_SECRET_ACCESS_KEY");
    }
  });

  it("applies defaults to region and s3Endpoint", () => {
    const r = loadStorageConfig(E(ENV));
    if (!r.configured) throw new Error("expected configured");
    expect(r.config.region).toBe(DEFAULT_REGION);
    expect(r.config.s3Endpoint).toContain(DEFAULT_REGION);
  });

  it("honours overrides for region and s3Endpoint", () => {
    const r = loadStorageConfig(E({ ...ENV, NEBIUS_REGION: "eu-north1", NEBIUS_S3_ENDPOINT: "https://custom.s3" }));
    if (!r.configured) throw new Error("expected configured");
    expect(r.config.region).toBe("eu-north1");
    expect(r.config.s3Endpoint).toBe("https://custom.s3");
  });

  it("strips whitespace from all values", () => {
    const r = loadStorageConfig(E({
      NEBIUS_BUCKET: "  bucket  ",
      NEBIUS_S3_ACCESS_KEY_ID: "  ak  ",
      NEBIUS_S3_SECRET_ACCESS_KEY: "  sk  ",
      NEBIUS_REGION: "  eu-west1  ",
    }));
    if (!r.configured) throw new Error("expected configured");
    expect(r.config.bucket).toBe("bucket");
    expect(r.config.s3AccessKeyId).toBe("ak");
    expect(r.config.s3SecretAccessKey).toBe("sk");
    expect(r.config.region).toBe("eu-west1");
  });

  it("treats blank values as missing", () => {
    const r = loadStorageConfig(E({ NEBIUS_BUCKET: "  ", NEBIUS_S3_ACCESS_KEY_ID: "ak", NEBIUS_S3_SECRET_ACCESS_KEY: "sk" }));
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toContain("NEBIUS_BUCKET");
    }
  });
});

describe("loadConfig", () => {
  it("returns missing variables for unconfigured", () => {
    const r = loadConfig(E({}));
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toHaveLength(7); // all required vars
    }
  });

  it("returns storage missing vars when storage is incomplete", () => {
    const r = loadConfig(E({
      NEBIUS_SERVICE_ACCOUNT_ID: "sa",
      NEBIUS_AUTH_KEY_ID: "key",
      NEBIUS_AUTH_PRIVATE_KEY: "pem",
      NEBIUS_PROJECT_ID: "proj",
      NEBIUS_SUBNET_ID: "subnet",
    }));
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toContain("NEBIUS_BUCKET");
    }
  });

  it("applies defaults and unescapes \\n in PEM", () => {
    const r = loadConfig(E({
      ...ENV,
      NEBIUS_AUTH_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----",
    }));
    if (!r.configured) throw new Error("expected configured");
    expect(r.config.privateKeyPem).toContain("\n");
    expect(r.config.privateKeyPem).not.toContain("\\n");
  });

  it("reads process.env by default", () => {
    vi.stubEnv("NEBIUS_BUCKET", "");
    const r = loadConfig();
    expect(r.configured).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("parseJobTarget", () => {
  it("parses valid region:project:subnet format", () => {
    const r = parseJobTarget("eu-west1:project-123:vpcsubnet-456");
    expect(r).toEqual({ region: "eu-west1", projectId: "project-123", subnetId: "vpcsubnet-456" });
  });

  it("returns null for invalid formats", () => {
    expect(parseJobTarget("eu-west1:project-123")).toBeNull();
    expect(parseJobTarget("eu-west1:bad-id:vpcsubnet-456")).toBeNull();
    expect(parseJobTarget("eu-west1:project-123:bad-id")).toBeNull();
    expect(parseJobTarget("eu-west1:project-123:vpcsubnet-456:extra")).toBeNull();
  });

  it("returns null for undefined or blank input", () => {
    expect(parseJobTarget(undefined)).toBeNull();
    expect(parseJobTarget("  ")).toBeNull();
  });

  it("trims whitespace", () => {
    const r = parseJobTarget("  eu-west1:project-123:vpcsubnet-456  ");
    expect(r).toEqual({ region: "eu-west1", projectId: "project-123", subnetId: "vpcsubnet-456" });
  });
});

describe("loadTokenFactoryConfig", () => {
  it("returns null without an API key", () => {
    expect(loadTokenFactoryConfig(E({}))).toBeNull();
    expect(loadTokenFactoryConfig(E({ TOKENFACTORY_API_KEY: "  " }))).toBeNull();
  });

  it("applies defaults and overrides", () => {
    const r = loadTokenFactoryConfig(E({ TOKENFACTORY_API_KEY: "key-123" }));
    expect(r).toEqual({
      apiKey: "key-123",
      baseUrl: TOKEN_FACTORY_BASE_URL,
      models: DEFAULT_MODELS,
    });
  });

  it("honours model call overrides", () => {
    const r = loadTokenFactoryConfig(E({
      TOKENFACTORY_API_KEY: "key-123",
      MODEL_CALL_1: "model-1",
      MODEL_CALL_2: "model-2",
      MODEL_CALL_3: "model-3",
    }));
    expect(r?.models).toEqual({
      extract: "model-1",
      propose: "model-2",
      message: "model-3",
    });
  });

  it("strips trailing slashes from baseUrl", () => {
    const r = loadTokenFactoryConfig(E({
      TOKENFACTORY_API_KEY: "key",
      TOKENFACTORY_BASE_URL: "https://custom.api///",
    }));
    expect(r?.baseUrl).toBe("https://custom.api");
  });

  it("reads process.env by default", () => {
    vi.stubEnv("TOKENFACTORY_API_KEY", "");
    expect(loadTokenFactoryConfig()).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("loadTavilyConfig", () => {
  it("returns key mode when API key is present", () => {
    const r = loadTavilyConfig(E({ TAVILY_API_KEY: "key-123" }));
    expect(r).toEqual({
      baseUrl: TAVILY_BASE_URL,
      access: "key",
      apiKey: "key-123",
    });
  });

  it("returns keyless mode when TAVILY_ACCESS=keyless", () => {
    const r = loadTavilyConfig(E({ TAVILY_ACCESS: "keyless" }));
    expect(r).toEqual({
      baseUrl: TAVILY_BASE_URL,
      access: "keyless",
      apiKey: null,
    });
  });

  it("prefers key mode over keyless when both are present", () => {
    const r = loadTavilyConfig(E({ TAVILY_API_KEY: "key-123", TAVILY_ACCESS: "keyless" }));
    expect(r?.access).toBe("key");
  });

  it("returns null when neither key nor keyless is configured", () => {
    expect(loadTavilyConfig(E({}))).toBeNull();
    expect(loadTavilyConfig(E({ TAVILY_ACCESS: "invalid" }))).toBeNull();
  });

  it("honours baseUrl override and strips trailing slashes", () => {
    const r = loadTavilyConfig(E({
      TAVILY_API_KEY: "key",
      TAVILY_BASE_URL: "https://custom.api///",
    }));
    expect(r?.baseUrl).toBe("https://custom.api");
  });

  it("ignores whitespace in TAVILY_ACCESS", () => {
    const r = loadTavilyConfig(E({ TAVILY_ACCESS: "  KEYLESS  " }));
    expect(r?.access).toBe("keyless");
  });

  it("reads process.env by default", () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("TAVILY_ACCESS", "");
    expect(loadTavilyConfig()).toBeNull();
    vi.unstubAllEnvs();
  });
});
