import { describe, expect, it, vi } from "vitest";
import {
  resolveExecutionRunAdapterConfig,
  applyPersistedExecutionWorkspaceConfig,
  stripWorkspaceRuntimeFromExecutionRunConfig,
} from "../services/heartbeat.ts";
import { buildExecutionWorkspaceAdapterConfig } from "../services/execution-workspace-policy.ts";

/**
 * Regression tests for the dangerouslySkipPermissions field propagation.
 *
 * These tests verify that the field flows correctly from the DB adapter_config
 * through every intermediate layer to the final runtimeConfig that reaches
 * the adapter execute() entry point.
 */

describe("dangerouslySkipPermissions propagation", () => {
  const noopSecretsSvc = {
    resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
      config: { ...config },
      secretKeys: new Set<string>(),
    })),
    resolveEnvBindings: vi.fn(async () => ({
      env: {} as Record<string, string>,
      secretKeys: new Set<string>(),
    })),
  };

  describe("buildExecutionWorkspaceAdapterConfig preserves field", () => {
    it("preserves dangerouslySkipPermissions=true", () => {
      const result = buildExecutionWorkspaceAdapterConfig({
        agentConfig: { cwd: "/app", dangerouslySkipPermissions: true },
        projectPolicy: null,
        issueSettings: null,
        mode: "agent_default",
        legacyUseProjectWorkspace: null,
      });
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it("preserves dangerouslySkipPermissions=false", () => {
      const result = buildExecutionWorkspaceAdapterConfig({
        agentConfig: { cwd: "/app", dangerouslySkipPermissions: false },
        projectPolicy: null,
        issueSettings: null,
        mode: "agent_default",
        legacyUseProjectWorkspace: null,
      });
      expect(result.dangerouslySkipPermissions).toBe(false);
    });

    it("preserves field through isolated_workspace mode", () => {
      const result = buildExecutionWorkspaceAdapterConfig({
        agentConfig: { cwd: "/app", dangerouslySkipPermissions: false },
        projectPolicy: { enabled: true, defaultMode: "isolated_workspace" },
        issueSettings: { mode: "isolated_workspace" },
        mode: "isolated_workspace",
        legacyUseProjectWorkspace: null,
      });
      expect(result.dangerouslySkipPermissions).toBe(false);
    });
  });

  describe("applyPersistedExecutionWorkspaceConfig preserves field", () => {
    it("preserves dangerouslySkipPermissions through workspace config application", () => {
      const result = applyPersistedExecutionWorkspaceConfig({
        config: { dangerouslySkipPermissions: false, cwd: "/app" },
        workspaceConfig: null,
        mode: "agent_default",
      });
      expect(result.dangerouslySkipPermissions).toBe(false);
    });
  });

  describe("stripWorkspaceRuntimeFromExecutionRunConfig preserves field", () => {
    it("preserves dangerouslySkipPermissions=true while stripping workspaceRuntime", () => {
      const result = stripWorkspaceRuntimeFromExecutionRunConfig({
        dangerouslySkipPermissions: true,
        workspaceRuntime: { services: [] },
        cwd: "/app",
      });
      expect(result.dangerouslySkipPermissions).toBe(true);
      expect(result.workspaceRuntime).toBeUndefined();
    });

    it("preserves dangerouslySkipPermissions=false while stripping workspaceRuntime", () => {
      const result = stripWorkspaceRuntimeFromExecutionRunConfig({
        dangerouslySkipPermissions: false,
        workspaceRuntime: { services: [] },
        cwd: "/app",
      });
      expect(result.dangerouslySkipPermissions).toBe(false);
    });
  });

  describe("resolveExecutionRunAdapterConfig preserves field", () => {
    it("preserves dangerouslySkipPermissions=true through secret resolution", async () => {
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };

      const result = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: { dangerouslySkipPermissions: true, cwd: "/app" },
        projectEnv: null,
        secretsSvc: svc as any,
      });
      expect(result.resolvedConfig.dangerouslySkipPermissions).toBe(true);
    });

    it("preserves dangerouslySkipPermissions=false through secret resolution", async () => {
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };

      const result = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: { dangerouslySkipPermissions: false, cwd: "/app" },
        projectEnv: null,
        secretsSvc: svc as any,
      });
      expect(result.resolvedConfig.dangerouslySkipPermissions).toBe(false);
    });

    it("preserves missing field as undefined (runtime will apply default)", async () => {
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };

      const result = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: { cwd: "/app" },
        projectEnv: null,
        secretsSvc: svc as any,
      });
      expect(result.resolvedConfig.dangerouslySkipPermissions).toBeUndefined();
    });
  });

  describe("end-to-end config pipeline", () => {
    it("DB true → final config has dangerouslySkipPermissions=true", async () => {
      const dbConfig = { cwd: "/app", dangerouslySkipPermissions: true };
      const workspaceManaged = buildExecutionWorkspaceAdapterConfig({
        agentConfig: dbConfig,
        projectPolicy: null,
        issueSettings: null,
        mode: "agent_default",
        legacyUseProjectWorkspace: null,
      });
      const persisted = applyPersistedExecutionWorkspaceConfig({
        config: workspaceManaged,
        workspaceConfig: null,
        mode: "agent_default",
      });
      const stripped = stripWorkspaceRuntimeFromExecutionRunConfig(persisted);
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };
      const { resolvedConfig } = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: stripped,
        projectEnv: null,
        secretsSvc: svc as any,
      });
      const runtimeConfig = { ...resolvedConfig };
      expect(runtimeConfig.dangerouslySkipPermissions).toBe(true);
    });

    it("DB false → final config has dangerouslySkipPermissions=false", async () => {
      const dbConfig = { cwd: "/app", dangerouslySkipPermissions: false };
      const workspaceManaged = buildExecutionWorkspaceAdapterConfig({
        agentConfig: dbConfig,
        projectPolicy: null,
        issueSettings: null,
        mode: "agent_default",
        legacyUseProjectWorkspace: null,
      });
      const persisted = applyPersistedExecutionWorkspaceConfig({
        config: workspaceManaged,
        workspaceConfig: null,
        mode: "agent_default",
      });
      const stripped = stripWorkspaceRuntimeFromExecutionRunConfig(persisted);
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };
      const { resolvedConfig } = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: stripped,
        projectEnv: null,
        secretsSvc: svc as any,
      });
      const runtimeConfig = { ...resolvedConfig };
      expect(runtimeConfig.dangerouslySkipPermissions).toBe(false);
    });

    it("field missing in DB → undefined in final config (asBoolean applies runtime default)", async () => {
      const dbConfig = { cwd: "/app" };
      const workspaceManaged = buildExecutionWorkspaceAdapterConfig({
        agentConfig: dbConfig,
        projectPolicy: null,
        issueSettings: null,
        mode: "agent_default",
        legacyUseProjectWorkspace: null,
      });
      const persisted = applyPersistedExecutionWorkspaceConfig({
        config: workspaceManaged,
        workspaceConfig: null,
        mode: "agent_default",
      });
      const stripped = stripWorkspaceRuntimeFromExecutionRunConfig(persisted);
      const svc = {
        ...noopSecretsSvc,
        resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({
          config: { ...config },
          secretKeys: new Set<string>(),
        })),
      };
      const { resolvedConfig } = await resolveExecutionRunAdapterConfig({
        companyId: "c1",
        executionRunConfig: stripped,
        projectEnv: null,
        secretsSvc: svc as any,
      });
      const runtimeConfig = { ...resolvedConfig };
      expect(runtimeConfig.dangerouslySkipPermissions).toBeUndefined();
    });
  });
});
