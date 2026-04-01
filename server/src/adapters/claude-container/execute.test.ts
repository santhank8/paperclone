import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const cp = await importOriginal<typeof import("node:child_process")>();
  return { ...cp, execSync: vi.fn() };
});

import { buildDockerArgs, cleanupOrphanedContainers } from "./execute.js";
import { execSync } from "node:child_process";
const mockedExecSync = vi.mocked(execSync);

describe("buildDockerArgs", () => {
  it("builds correct docker run arguments", () => {
    const args = buildDockerArgs({
      runId: "run-123",
      agentId: "agent-456",
      workspaceDir: "/home/geoff/paperclip/workspaces/agent-456",
      sessionsDir: "/home/geoff/paperclip/workspaces/agent-456/.claude-sessions",
      skillsDir: "/tmp/skills-run-123",
      env: { ANTHROPIC_API_KEY: "sk-test", HOME: "/home/user" },
      memoryMb: 2048,
      cpus: 1.5,
      network: "pkb-net",
      image: "nanoclaw-agent:latest",
    });

    expect(args).toContain("--rm");
    expect(args).toContain("--name");
    expect(args).toContain("paperclip-run-run-123");
    expect(args).toContain("--network");
    expect(args).toContain("pkb-net");
    expect(args).toContain("--memory");
    expect(args).toContain("2048m");
    expect(args).toContain("--cpus");
    expect(args).toContain("1.5");
    expect(args).toContain("--security-opt");
    expect(args).toContain("no-new-privileges:true");
    expect(args).toContain("nanoclaw-agent:latest");

    // Check volume mounts
    const volumeArgs = args.filter((_, i) => args[i - 1] === "-v");
    expect(volumeArgs).toContainEqual(
      "/home/geoff/paperclip/workspaces/agent-456:/workspace",
    );
    expect(volumeArgs).toContainEqual(
      "/home/geoff/paperclip/workspaces/agent-456/.claude-sessions:/home/user/.claude",
    );
    expect(volumeArgs).toContainEqual(
      "/tmp/skills-run-123:/home/user/.claude/skills:ro",
    );

    // Check env vars
    const envArgs = args.filter((_, i) => args[i - 1] === "-e");
    expect(envArgs).toContain("ANTHROPIC_API_KEY=sk-test");
    expect(envArgs).toContain("HOME=/home/user");
  });
});

describe("cleanupOrphanedContainers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes containers matching paperclip-run-* pattern", async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === "string" && cmd.includes("docker ps")) {
        return "paperclip-run-old-1\npaperclip-run-old-2\n";
      }
      return "";
    });

    await cleanupOrphanedContainers();

    const rmCall = mockedExecSync.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("docker rm -f"),
    );
    expect(rmCall).toBeDefined();
    expect(rmCall![0]).toContain("paperclip-run-old-1");
    expect(rmCall![0]).toContain("paperclip-run-old-2");
  });

  it("does nothing when no orphaned containers exist", async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === "string" && cmd.includes("docker ps")) return "";
      return "";
    });

    await cleanupOrphanedContainers();

    const rmCall = mockedExecSync.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("docker rm"),
    );
    expect(rmCall).toBeUndefined();
  });
});
