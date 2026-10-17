import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODELS, DEFAULT_REGION, loadConfig, loadStorageConfig, loadTavilyConfig, loadTokenFactoryConfig, parseJobTarget,
} from "@/lib/nebius/config";

const E = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
const storageEnv = { NEBIUS_BUCKET: " b ", NEBIUS_S3_ACCESS_KEY_ID: "ak", NEBIUS_S3_SECRET_ACCESS_KEY: "sk" };
const fullEnv = {
  ...storageEnv,
  NEBIUS_SERVICE_ACCOUNT_ID: "sa", NEBIUS_AUTH_KEY_ID: "kid", NEBIUS_AUTH_PRIVATE_KEY: "A\\nB",
  NEBIUS_PROJECT_ID: "project-x", NEBIUS_SUBNET_ID: "vpcsubnet-y",
};

describe("loadStorageConfig", () => {
  it("reports missing keys", () => {
    expect(loadStorageConfig(E({}))).toEqual({ configured: false, missing: ["NEBIUS_BUCKET", "NEBIUS_S3_ACCESS_KEY_ID", "NEBIUS_S3_SECRET_ACCESS_KEY"] });
  });
  it("defaults region and endpoint", () => {
    const r = loadStorageConfig(E(storageEnv));
    expect(r).toEqual({ configured: true, config: { bucket: "b", region: DEFAULT_REGION, s3Endpoint: "https://storage.eu-west1.nebius.cloud", s3AccessKeyId: "ak", s3SecretAccessKey: "sk" } });
  });
  it("honours explicit region and endpoint", () => {
    const r = loadStorageConfig(E({ ...storageEnv, NEBIUS_REGION: "uk", NEBIUS_S3_ENDPOINT: "https://e" }));
    expect(r.configured && r.config).toMatchObject({ region: "uk", s3Endpoint: "https://e" });
  });
});

describe("loadConfig", () => {
  it("reports missing keys", () => {
    const r = loadConfig(E(storageEnv));
    expect(r.configured).toBe(false);
    expect(!r.configured && r.missing).toContain("NEBIUS_PROJECT_ID");
  });
  it("loads and unescapes the PEM", () => {
    const r = loadConfig(E(fullEnv));
    expect(r.configured && r.config).toMatchObject({ privateKeyPem: "A\nB", projectId: "project-x", subnetId: "vpcsubnet-y", serviceAccountId: "sa", authKeyId: "kid", bucket: "b" });
  });
  it("defaults to process.env", () => {
    expect(loadConfig().configured).toBe(false);
    expect(loadStorageConfig().configured).toBe(false);
    expect(loadTokenFactoryConfig()).toBeNull();
    expect(loadTavilyConfig()).toBeNull();
  });
});

describe("parseJobTarget", () => {
  it("parses a valid target", () => {
    expect(parseJobTarget(" uk-south1:project-a:vpcsubnet-b ")).toEqual({ region: "uk-south1", projectId: "project-a", subnetId: "vpcsubnet-b" });
  });
  it.each([undefined, "", "a:project-b", "a:b:vpcsubnet-c", "a:project-b:c", ":project-b:vpcsubnet-c", "a:project-b:vpcsubnet-c:d"])("rejects %s", (raw) => {
    expect(parseJobTarget(raw)).toBeNull();
  });
});

describe("loadTokenFactoryConfig", () => {
  it("is null without a key", () => expect(loadTokenFactoryConfig(E({ TOKENFACTORY_API_KEY: "  " }))).toBeNull());
  it("applies defaults", () => {
    expect(loadTokenFactoryConfig(E({ TOKENFACTORY_API_KEY: "k" }))).toEqual({ apiKey: "k", baseUrl: "https://api.tokenfactory.nebius.com/v1", models: DEFAULT_MODELS });
  });
  it("applies overrides and trims trailing slashes", () => {
    expect(loadTokenFactoryConfig(E({ TOKENFACTORY_API_KEY: "k", TOKENFACTORY_BASE_URL: "https://x//", MODEL_CALL_1: "a", MODEL_CALL_2: "b", MODEL_CALL_3: "c" }))).toEqual({
      apiKey: "k", baseUrl: "https://x", models: { extract: "a", propose: "b", message: "c" },
    });
  });
});

describe("loadTavilyConfig", () => {
  it("uses a key", () => expect(loadTavilyConfig(E({ TAVILY_API_KEY: "k", TAVILY_BASE_URL: "https://t/" }))).toEqual({ baseUrl: "https://t", access: "key", apiKey: "k" }));
  it("uses keyless only when enabled", () => {
    expect(loadTavilyConfig(E({ TAVILY_ACCESS: "Keyless" }))).toEqual({ baseUrl: "https://api.tavily.com", access: "keyless", apiKey: null });
    expect(loadTavilyConfig(E({ TAVILY_ACCESS: "other" }))).toBeNull();
  });
});
