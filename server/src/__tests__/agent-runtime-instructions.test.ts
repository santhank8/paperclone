import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { materializeAgentInstructionsForRuntime } from "../services/agent-runtime-instructions.js";

const ENV_KEYS = [
  "PAPERCLIP_AGENT_RUNTIME_DIR",
  "PAPERCLIP_AGENTS_DIR_IN_CONTAINER",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>;

afterEach(async () => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("materializeAgentInstructionsForRuntime", () => {
  it("copies instructions from the mounted agents directory into the per-agent runtime home", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-agent-instructions-"));
    const runtimeDir = path.join(root, "runtime");
    const mountedAgentsDir = path.join(root, "mounted-agents");
    const sourcePath = path.join(mountedAgentsDir, "cfo", "AGENTS.md");
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, "# CFO\nship it\n", "utf8");

    process.env.PAPERCLIP_AGENT_RUNTIME_DIR = runtimeDir;
    process.env.PAPERCLIP_AGENTS_DIR_IN_CONTAINER = mountedAgentsDir;

    const result = await materializeAgentInstructionsForRuntime({
      agentId: "agent-cfo",
      configuredPath: "/nonexistent-host/worktree/agents/cfo/AGENTS.md",
    });

    expect(result.sourcePath).toBe(sourcePath);
    expect(result.runtimePath).toBe(path.join(runtimeDir, "agent-cfo", "AGENTS.md"));
    expect(await fs.readFile(result.runtimePath!, "utf8")).toBe("# CFO\nship it\n");
  });

  it("reuses the persisted runtime copy when the original source path is no longer readable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-agent-instructions-"));
    const runtimeDir = path.join(root, "runtime");
    const runtimePath = path.join(runtimeDir, "agent-cfo", "AGENTS.md");
    await fs.mkdir(path.dirname(runtimePath), { recursive: true });
    await fs.writeFile(runtimePath, "# CFO\ncached copy\n", "utf8");

    process.env.PAPERCLIP_AGENT_RUNTIME_DIR = runtimeDir;
    process.env.PAPERCLIP_AGENTS_DIR_IN_CONTAINER = path.join(root, "mounted-agents");

    const result = await materializeAgentInstructionsForRuntime({
      agentId: "agent-cfo",
      configuredPath: "/nonexistent-host/worktree/agents/cfo/AGENTS.md",
    });

    expect(result.sourcePath).toBeNull();
    expect(result.runtimePath).toBe(runtimePath);
    expect(await fs.readFile(result.runtimePath!, "utf8")).toBe("# CFO\ncached copy\n");
  });
});
