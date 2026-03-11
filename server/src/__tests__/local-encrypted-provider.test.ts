import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localEncryptedProvider } from "../secrets/local-encrypted-provider.js";

const ENV_KEYS = [
  "PAPERCLIP_HOME",
  "PAPERCLIP_INSTANCE_ID",
  "PAPERCLIP_IN_CONTAINER",
  "PAPERCLIP_SECRETS_MASTER_KEY_FILE",
  "PAPERCLIP_SECRETS_MASTER_KEY",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("localEncryptedProvider", () => {
  it("falls back to the persisted instance key when a container-only configured path is missing", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-local-encrypted-"));
    const persistedKeyDir = path.join(tempDir, "instances", "default", "secrets");
    const persistedKeyPath = path.join(persistedKeyDir, "master.key");
    fs.mkdirSync(persistedKeyDir, { recursive: true });
    const persistedKey = Buffer.alloc(32, 7).toString("base64");
    fs.writeFileSync(persistedKeyPath, persistedKey, "utf8");

    process.env.PAPERCLIP_HOME = tempDir;
    process.env.PAPERCLIP_INSTANCE_ID = "default";
    process.env.PAPERCLIP_IN_CONTAINER = "true";
    const missingConfiguredPath = path.join(tempDir, "missing-host", "secrets", "master.key");
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = missingConfiguredPath;
    delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;

    const prepared = await localEncryptedProvider.createVersion({ value: "top-secret" });
    const resolved = await localEncryptedProvider.resolveVersion({
      material: prepared.material,
      externalRef: null,
    });

    expect(resolved).toBe("top-secret");
    expect(fs.readFileSync(persistedKeyPath, "utf8").trim()).toBe(persistedKey);
    expect(fs.existsSync(missingConfiguredPath)).toBe(false);
  });
});
