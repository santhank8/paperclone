import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const {
  mockRunChildProcess,
  mockEnsureCommandResolvable,
  mockListPaperclipSkillEntries,
  mockRemoveMaintainerOnlySkillSymlinks,
  mockEnsurePiModelConfiguredAndAvailable,
} = vi.hoisted(() => ({
  mockRunChildProcess: vi.fn(),
  mockEnsureCommandResolvable: vi.fn(),
  mockListPaperclipSkillEntries: vi.fn(),
  mockRemoveMaintainerOnlySkillSymlinks: vi.fn(),
  mockEnsurePiModelConfiguredAndAvailable: vi.fn(),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    runChildProcess: mockRunChildProcess,
    ensureCommandResolvable: mockEnsureCommandResolvable,
    listPaperclipSkillEntries: mockListPaperclipSkillEntries,
    removeMaintainerOnlySkillSymlinks: mockRemoveMaintainerOnlySkillSymlinks,
  };
});

vi.mock("./models.js", () => ({
  ensurePiModelConfiguredAndAvailable: mockEnsurePiModelConfiguredAndAvailable,
}));

import { execute } from "./execute.js";

function buildContext(
  overrides: Partial<AdapterExecutionContext> = {},
): AdapterExecutionContext {
  return {
    runId: "run-123",
    agent: {
      id: "agent-123",
      companyId: "company-123",
      name: "CEO",
      adapterType: "pi_local",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      command: "pi",
      model: "openai-codex/gpt-5.4",
    },
    context: {},
    onLog: async () => {},
    onMeta: async () => {},
    authToken: "pcp-test-token",
    ...overrides,
  };
}

describe("pi execute", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-pi-execute-"));
    mockEnsureCommandResolvable.mockResolvedValue(undefined);
    mockListPaperclipSkillEntries.mockResolvedValue([]);
    mockRemoveMaintainerOnlySkillSymlinks.mockResolvedValue([]);
    mockEnsurePiModelConfiguredAndAvailable.mockResolvedValue([]);
    mockRunChildProcess.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: [
        JSON.stringify({ type: "agent_start" }),
        JSON.stringify({
          type: "turn_end",
          message: { role: "assistant", content: "hello" },
        }),
        JSON.stringify({ type: "agent_end", messages: [] }),
      ].join("\n"),
      stderr: "",
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("passes the same project workspace metadata env fields as other local adapters", async () => {
    const cwd = path.join(tempDir, "project");
    await fs.mkdir(cwd, { recursive: true });

    const onMeta = vi.fn(async () => {});

    await execute(
      buildContext({
        config: {
          command: "pi",
          model: "openai-codex/gpt-5.4",
        },
        context: {
          issueId: "issue-123",
          paperclipWorkspace: {
            cwd,
            source: "project_primary",
            strategy: "git_worktree",
            workspaceId: "workspace-123",
            repoUrl: "https://github.com/acme/repo.git",
            repoRef: "main",
            branchName: "issue-123-fix",
            worktreePath: "/tmp/worktree-path",
          },
          paperclipWorkspaces: [{ workspaceId: "workspace-123", cwd }],
          paperclipRuntimeServiceIntents: [{ serviceName: "devserver" }],
          paperclipRuntimeServices: [{ serviceName: "devserver", url: "http://127.0.0.1:4173" }],
          paperclipRuntimePrimaryUrl: "http://127.0.0.1:4173",
        },
        onMeta,
      }),
    );

    expect(mockRunChildProcess).toHaveBeenCalledTimes(1);
    const [, , , runOpts] = mockRunChildProcess.mock.calls[0];
    expect(runOpts.cwd).toBe(cwd);
    expect(runOpts.env.PAPERCLIP_WORKSPACE_CWD).toBe(cwd);
    expect(runOpts.env.PAPERCLIP_WORKSPACE_SOURCE).toBe("project_primary");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_STRATEGY).toBe("git_worktree");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_ID).toBe("workspace-123");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_REPO_URL).toBe("https://github.com/acme/repo.git");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_REPO_REF).toBe("main");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_BRANCH).toBe("issue-123-fix");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_WORKTREE_PATH).toBe("/tmp/worktree-path");
    expect(runOpts.env.PAPERCLIP_RUNTIME_SERVICE_INTENTS_JSON).toBe(
      JSON.stringify([{ serviceName: "devserver" }]),
    );
    expect(runOpts.env.PAPERCLIP_RUNTIME_SERVICES_JSON).toBe(
      JSON.stringify([{ serviceName: "devserver", url: "http://127.0.0.1:4173" }]),
    );
    expect(runOpts.env.PAPERCLIP_RUNTIME_PRIMARY_URL).toBe("http://127.0.0.1:4173");

    expect(onMeta).toHaveBeenCalledTimes(1);
    const metaCalls = onMeta.mock.calls as unknown as Array<[unknown]>;
    const meta = (metaCalls[0]?.[0] ?? undefined) as
      | { cwd?: string; commandArgs?: string[] }
      | undefined;
    expect(meta).toBeDefined();
    expect(meta?.cwd).toBe(cwd);
    expect(meta?.commandArgs).toContain("--mode");
    expect(meta?.commandArgs).toContain("rpc");
  });

  it("uses configured cwd instead of agent_home fallback without exporting fallback workspace cwd", async () => {
    const configuredCwd = path.join(tempDir, "configured-workspace");
    await fs.mkdir(configuredCwd, { recursive: true });

    await execute(
      buildContext({
        config: {
          command: "pi",
          model: "openai-codex/gpt-5.4",
          cwd: configuredCwd,
        },
        context: {
          paperclipWorkspace: {
            cwd: "/Users/example/.paperclip/instances/default/workspaces/agent-123",
            source: "agent_home",
          },
        },
      }),
    );

    expect(mockRunChildProcess).toHaveBeenCalledTimes(1);
    const [, , , runOpts] = mockRunChildProcess.mock.calls[0];
    expect(runOpts.cwd).toBe(configuredCwd);
    expect(runOpts.env.PAPERCLIP_WORKSPACE_SOURCE).toBe("agent_home");
    expect(runOpts.env.PAPERCLIP_WORKSPACE_CWD).toBeUndefined();
  });
});
