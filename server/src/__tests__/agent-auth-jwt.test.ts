import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalAgentJwt,
  verifyLocalAgentJwt,
  initJwtSecret,
} from "../agent-auth-jwt.js";

describe("agent local JWT", () => {
  const secretEnv = "PAPERCLIP_AGENT_JWT_SECRET";
  const ttlEnv = "PAPERCLIP_AGENT_JWT_TTL_SECONDS";
  const issuerEnv = "PAPERCLIP_AGENT_JWT_ISSUER";
  const audienceEnv = "PAPERCLIP_AGENT_JWT_AUDIENCE";
  const previousSecretEnv = "PAPERCLIP_AGENT_JWT_SECRET_PREVIOUS";
  const gcpProjectEnv = "PAPERCLIP_GCP_PROJECT_ID";
  const smNameEnv = "PAPERCLIP_AGENT_JWT_SECRET_SM_NAME";
  const smVersionEnv = "PAPERCLIP_AGENT_JWT_SECRET_SM_VERSION";

  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    secretEnv,
    ttlEnv,
    issuerEnv,
    audienceEnv,
    previousSecretEnv,
    gcpProjectEnv,
    smNameEnv,
    smVersionEnv,
  ];

  beforeEach(() => {
    for (const key of envKeys) savedEnv[key] = process.env[key];
    process.env[secretEnv] = "test-secret";
    process.env[ttlEnv] = "3600";
    delete process.env[issuerEnv];
    delete process.env[audienceEnv];
    delete process.env[previousSecretEnv];
    delete process.env[gcpProjectEnv];
    delete process.env[smNameEnv];
    delete process.env[smVersionEnv];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("creates and verifies a token", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    const claims = verifyLocalAgentJwt(token!);
    expect(claims).toMatchObject({
      sub: "agent-1",
      company_id: "company-1",
      adapter_type: "claude_local",
      run_id: "run-1",
      iss: "paperclip",
      aud: "paperclip-api",
    });
  });

  it("returns null when secret is missing", () => {
    process.env[secretEnv] = "";
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(token).toBeNull();
    expect(verifyLocalAgentJwt("abc.def.ghi")).toBeNull();
  });

  it("rejects expired tokens", () => {
    process.env[ttlEnv] = "1";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    expect(verifyLocalAgentJwt(token!)).toBeNull();
  });

  it("rejects issuer/audience mismatch", () => {
    process.env[issuerEnv] = "custom-issuer";
    process.env[audienceEnv] = "custom-audience";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "codex_local", "run-1");

    process.env[issuerEnv] = "paperclip";
    process.env[audienceEnv] = "paperclip-api";
    expect(verifyLocalAgentJwt(token!)).toBeNull();
  });

  describe("initJwtSecret", () => {
    it("loads secret from env var", async () => {
      process.env[secretEnv] = "env-secret-value";
      await initJwtSecret();

      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const token = createLocalAgentJwt("a", "c", "claude_local", "r");
      expect(token).toBeTruthy();
      const claims = verifyLocalAgentJwt(token!);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe("a");
    });

    it("disables JWT auth when no secret source is configured", async () => {
      delete process.env[secretEnv];
      delete process.env[gcpProjectEnv];
      delete process.env[smNameEnv];
      await initJwtSecret();

      const token = createLocalAgentJwt("a", "c", "claude_local", "r");
      expect(token).toBeNull();
    });

    it("env var takes precedence over GCP SM config", async () => {
      process.env[secretEnv] = "env-wins";
      process.env[gcpProjectEnv] = "my-project";
      process.env[smNameEnv] = "my-secret";
      await initJwtSecret();

      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const token = createLocalAgentJwt("a", "c", "claude_local", "r");
      expect(token).toBeTruthy();
      // Token should verify — secret loaded from env, not SM
      expect(verifyLocalAgentJwt(token!)).not.toBeNull();
    });
  });

  describe("secret rotation (dual-secret validation)", () => {
    it("verifies token signed with previous secret during rotation window", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      // Sign token with old secret
      process.env[secretEnv] = "old-secret";
      await initJwtSecret();
      const tokenFromOld = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
      expect(tokenFromOld).toBeTruthy();

      // Rotate: new primary, old becomes previous
      process.env[secretEnv] = "new-secret";
      process.env[previousSecretEnv] = "old-secret";
      await initJwtSecret();

      // Token signed with old secret should still verify
      const claims = verifyLocalAgentJwt(tokenFromOld!);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe("agent-1");
    });

    it("verifies token signed with new secret after rotation", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      process.env[secretEnv] = "new-secret";
      process.env[previousSecretEnv] = "old-secret";
      await initJwtSecret();

      const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
      expect(token).toBeTruthy();

      const claims = verifyLocalAgentJwt(token!);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe("agent-1");
    });

    it("rejects token signed with unknown secret even during rotation", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      // Sign with a secret that is neither current nor previous
      process.env[secretEnv] = "rogue-secret";
      await initJwtSecret();
      const rogueToken = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");

      // Switch to different secrets
      process.env[secretEnv] = "new-secret";
      process.env[previousSecretEnv] = "old-secret";
      await initJwtSecret();

      expect(verifyLocalAgentJwt(rogueToken!)).toBeNull();
    });

    it("does not use previous secret when not set", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      // Sign with old secret
      process.env[secretEnv] = "old-secret";
      await initJwtSecret();
      const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");

      // Rotate without setting previous
      process.env[secretEnv] = "new-secret";
      delete process.env[previousSecretEnv];
      await initJwtSecret();

      // Old token should be rejected
      expect(verifyLocalAgentJwt(token!)).toBeNull();
    });
  });
});
