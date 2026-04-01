import { describe, expect, it } from "vitest";
import { buildDockerArgs } from "./execute.js";

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
